"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const parseJsonResponse = (text) => {
  if (!text) return null;
  try {
    // If it's already a clean JSON string from JSON mode
    return JSON.parse(text);
  } catch (e) {
    // Fallback if the model still included markdown or was slightly malformed
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/i);
    let raw = codeBlockMatch ? codeBlockMatch[1] : text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    let jsonString = jsonMatch[0].replace(/,(\s*[\]\}])/g, '$1');
    return JSON.parse(jsonString);
  }
};

const callGemini = async (prompt, config = {}) => {
  const apiKey = GEMINI_API_KEY_SECRET.value() || process.env.GEMINI_API_KEY;
  const client = new GoogleGenAI({ apiKey });

  logger.info("Calling Gemini SDK", { model: GEMINI_MODEL });

  try {
    const result = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 512,
        response_mime_type: "application/json",
        ...config,
      }
    });

    // Handle possible undefined text or blocked candidates
    const text = result.text;
    
    if (!text) {
      const blockage = result.candidates?.[0]?.finishReason;
      logger.error("Empty AI response", { finish_reason: blockage, raw: JSON.stringify(result) });
      throw new Error(`Gemini returned an empty response or was blocked: ${blockage || "Unknown"}`);
    }

    return text.trim();
  } catch (error) {
    logger.error("Gemini SDK request failed", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const buildPrompts = {
  classifyIncidentPriority: ({ incidentType, location, description = "" }) => `You are a crisis management AI for a hospitality venue. Classify the priority of this incident.

Incident Type: ${incidentType}
Location: ${location}
${description ? `Additional Details: ${description}` : ""}

Respond ONLY in valid JSON with exactly these fields.
IMPORTANT: Ensure valid JSON syntax. DO NOT include trailing commas.
{
  "priority": "critical" or "high" or "medium",
  "reasoning": "One sentence explaining why this priority level was chosen",
  "severity": number,
  "recommended_actions": ["action 1", "action 2", "action 3"]
}

Classification rules:
- Fire, explosion, active shooter, structural collapse -> critical (severity 8-10)
- Medical emergency, gas leak, severe weather -> high (severity 5-7)
- Security disturbance, power outage, minor injury -> medium (severity 1-4)`,

  generateEMSBrief: ({ incident }) => {
    const taskArray = Array.isArray(incident?.tasks)
      ? incident.tasks
      : Object.entries(incident?.tasks || {}).map(([id, task]) => ({ id, ...task }));

    const taskSummary = taskArray
      .map((task) => `- Task ${task.id}: ${task.status} (assigned to ${task.staff_id || "unassigned"})`)
      .join("\n");

    return `You are a crisis management AI. Generate a concise EMS incident brief for first responders.

Incident ID: ${incident?.id}
Type: ${incident?.type}
Priority: ${incident?.priority}
Location: ${incident?.location}
Status: ${incident?.status}
Created: ${incident?.timestamp}
${incident?.aiReasoning ? `AI Assessment: ${incident.aiReasoning}` : ""}

Task Status:
${taskSummary || "No tasks assigned yet"}

Generate a structured EMS brief with:
1. SITUATION: What happened and current status
2. HAZARDS: Known or potential hazards on scene
3. ACCESS: Best access route and staging area suggestion
4. PATIENTS: Estimated patient count and severity
5. RESOURCES: What resources are already deployed

Keep each section to 1-2 sentences. Be direct and factual. Do not use markdown formatting.`;
  },

  getResponseRecommendations: ({ incident, availableStaff = [] }) => {
    const staffList = availableStaff
      .map((staff) => `- ${staff.name} (${staff.role})`)
      .join("\n");

    const elapsedSeconds = incident?.timestamp
      ? Math.max(0, Math.round((Date.now() - new Date(incident.timestamp).getTime()) / 1000))
      : 0;

    return `Act as a Crisis Response AI.
    
    Incident: ${incident?.type} at ${incident?.location}
    Details: ${incident?.rawMessage || incident?.aiSummary}
    Priority: ${incident?.priority}
    Available Staff: ${staffList || "None"}
    
    Output a JSON object with these EXACT keys:
    {
      "recommendations": [{"action": "string", "urgency": "immediate"|"soon"|"monitor"}],
      "escalation_needed": boolean,
      "estimated_resolution_time": "string",
      "verification_code": "4-digit-string"
    }`;
  },

  analyzeRawIncident: ({ message, location }) => `You are a professional crisis management AI. A guest has reported an issue.

Message: "${message}"
Location: "${location}"

Analyze the message and return a structured JSON response.

Classification Rules:
- Type: Must be one of ["fire", "medical", "security", "other"]
- Priority: "critical" (immediate life threat), "high" (serious injury/danger), "medium" (standard emergency), "low" (minor issue)
- Severity: A number 1-10 (10 being most severe)
- Keywords: Array of 3-5 specific medical/safety terms found or implied
- Summary: A professional, one-sentence brief for emergency responders
- Suggested Actions: Array of 3 immediate, actionable steps for staff

Return ONLY valid JSON:
{
  "type": "string",
  "priority": "string",
  "severity": number,
  "keywords": ["string"],
  "summary": "string",
  "suggested_actions": ["string"]
}`,
};

exports.runCrisisAiTask = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY_SECRET],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true
  },
  async (request) => {
    logger.info("runCrisisAiTask triggered", { task: request.data?.task, auth: !!request.auth });
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to use AI features.");
    }

    const task = request.data?.task;
    const payload = request.data?.payload || {};

    if (!task || !buildPrompts[task]) {
      throw new HttpsError("invalid-argument", "Unsupported AI task.");
    }

    try {
      const prompt = buildPrompts[task](payload);
      const text = await callGemini(prompt);

      if (task === "generateEMSBrief") {
        return { brief: text };
      }

      const parsed = parseJsonResponse(text);
      if (!parsed) {
        throw new Error("Failed to parse structured AI response.");
      }

      return parsed;
    } catch (error) {
      logger.error("AI task failed", {
        task,
        uid: request.auth.uid,
        message: error.message,
        stack: error.stack,
        payload
      });
      throw new HttpsError("internal", `AI processing failed: ${error.message}`);
    }
  }
);
