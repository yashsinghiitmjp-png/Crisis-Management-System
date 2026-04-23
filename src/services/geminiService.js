// Firebase AI Logic Service for Crisis Management
// Uses the Firebase AI SDK to interact with Gemini models
import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase";

// Create a `GenerativeModel` instance with the specified model
// Using gemini-3-flash-preview as requested in current documentation snippet
const model = getGenerativeModel(ai, { 
  model: "gemini-3-flash-preview",
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 1024,
  }
});

/**
 * Send a prompt to Gemini using the Firebase AI SDK.
 * Falls back gracefully if the call fails.
 */
const callGemini = async (prompt) => {
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text() || null;
  } catch (error) {
    console.error('Firebase AI Logic call failed:', error);
    return null;
  }
};

/**
 * Classify an incident's priority using Gemini AI.
 * Returns: { priority: 'critical'|'high'|'medium', reasoning: string }
 */
export const classifyIncidentPriority = async (incidentType, location, description = '') => {
  const prompt = `You are a crisis management AI for a hospitality venue. Classify the priority of this incident.

Incident Type: ${incidentType}
Location: ${location}
${description ? `Additional Details: ${description}` : ''}

Respond ONLY in valid JSON with exactly these fields:
{
  "priority": "critical" or "high" or "medium",
  "reasoning": "One sentence explaining why this priority level was chosen",
  "recommended_actions": ["action 1", "action 2", "action 3"]
}

Classification rules:
- Fire, explosion, active shooter, structural collapse → critical
- Medical emergency, gas leak, severe weather → high
- Security disturbance, power outage, minor injury → medium`;

  const result = await callGemini(prompt);

  if (result) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse Gemini priority response:', e);
    }
  }

  // Fallback to hardcoded logic
  const fallbackMap = { fire: 'critical', medical: 'high', security: 'medium' };
  return {
    priority: fallbackMap[incidentType?.toLowerCase()] || 'medium',
    reasoning: 'Classified using default rules (AI unavailable)',
    recommended_actions: ['Dispatch nearest available staff', 'Notify admin on duty', 'Document incident details'],
  };
};

/**
 * Generate an EMS summary brief for first responders.
 * Used when an incident is escalated or flagged red.
 */
export const generateEMSBrief = async (incident) => {
  const taskSummary = (incident.tasks || [])
    .map((t) => `- Task ${t.id}: ${t.status} (assigned to ${t.staff_id})`)
    .join('\n');

  const prompt = `You are a crisis management AI. Generate a concise EMS incident brief for first responders.

Incident ID: ${incident.id}
Type: ${incident.type}
Priority: ${incident.priority}
Location: ${incident.location}
Status: ${incident.status}
Created: ${incident.timestamp}
${incident.aiReasoning ? `AI Assessment: ${incident.aiReasoning}` : ''}

Task Status:
${taskSummary || 'No tasks assigned yet'}

Generate a structured EMS brief with:
1. SITUATION: What happened and current status
2. HAZARDS: Known or potential hazards on scene
3. ACCESS: Best access route and staging area suggestion
4. PATIENTS: Estimated patient count and severity
5. RESOURCES: What resources are already deployed

Keep each section to 1-2 sentences. Be direct and factual. Do not use markdown formatting.`;

  const result = await callGemini(prompt);

  if (result) {
    return result;
  }

  // Fallback brief
  return `EMS INCIDENT BRIEF — ${incident.id}
SITUATION: ${incident.type.toUpperCase()} emergency reported at ${incident.location}. Status: ${incident.status.toUpperCase()}.
HAZARDS: Standard ${incident.type} hazards apply. Assess on arrival.
ACCESS: Main entrance recommended. Confirm with on-site staff.
PATIENTS: Unknown — assess on arrival.
RESOURCES: ${(incident.tasks || []).length} staff member(s) dispatched. Priority: ${incident.priority.toUpperCase()}.`;
};

/**
 * Get AI-powered response recommendations for an active incident.
 */
export const getResponseRecommendations = async (incident, availableStaff) => {
  const staffList = availableStaff
    .map((s) => `- ${s.name} (${s.role}, ${s.isAvailable ? 'available' : 'busy'})`)
    .join('\n');

  const prompt = `You are a crisis management AI advisor. Provide response recommendations for this active incident.

Incident: ${incident.type.toUpperCase()} at ${incident.location}
Priority: ${incident.priority}
Current Status: ${incident.status}
Time Elapsed: ${Math.round((Date.now() - new Date(incident.timestamp).getTime()) / 1000)}s

Available Staff:
${staffList}

Provide exactly 3 actionable recommendations. Respond ONLY in valid JSON:
{
  "recommendations": [
    {"action": "short action description", "urgency": "immediate" or "soon" or "monitor"},
    {"action": "short action description", "urgency": "immediate" or "soon" or "monitor"},
    {"action": "short action description", "urgency": "immediate" or "soon" or "monitor"}
  ],
  "escalation_needed": true or false,
  "estimated_resolution_time": "X minutes"
}`;

  const result = await callGemini(prompt);

  if (result) {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse Gemini recommendations:', e);
    }
  }

  // Fallback
  return {
    recommendations: [
      { action: `Dispatch ${incident.type} specialist immediately`, urgency: 'immediate' },
      { action: 'Secure the area and limit access', urgency: 'immediate' },
      { action: 'Prepare incident report for handoff', urgency: 'soon' },
    ],
    escalation_needed: incident.priority === 'critical',
    estimated_resolution_time: '5-10 minutes',
  };
};

/**
 * Transform a raw guest message into a structured incident.
 * Extract type, severity, keywords, summary and suggested actions.
 */
export const analyzeRawIncident = async (message, location) => {
  const prompt = `You are a professional crisis management AI. A guest has reported an issue.
  
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
}`;

  const result = await callGemini(prompt);

  if (result) {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse structured incident:', e);
    }
  }

  // Fallback
  return {
    type: 'other',
    priority: 'medium',
    severity: 5,
    keywords: ['general assistance'],
    summary: `Guest reported: ${message}`,
    suggested_actions: ['Contact guest for clarification', 'Dispatch nearest available staff', 'Notify supervisor']
  };
};

/**
 * Check if Gemini AI service is initialized and reachable.
 */
export const checkGeminiStatus = async () => {
  if (!ai) return { connected: false, reason: 'AI service not initialized' };

  try {
    const result = await callGemini('Respond with exactly: OK');
    return { connected: !!result, reason: result ? 'Connected' : 'No response from AI SDK' };
  } catch (error) {
    return { connected: false, reason: `Connection failed: ${error.message}` };
  }
};
