import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const runCrisisAiTask = httpsCallable(functions, "runCrisisAiTask");

const callAiTask = async (task, payload) => {
  try {
    const result = await runCrisisAiTask({ task, payload });
    return result.data ?? null;
  } catch (error) {
    console.error(`AI task "${task}" failed:`, error);
    return null;
  }
};

/**
 * Classify an incident's priority using the protected backend AI proxy.
 * Returns: { priority: 'critical'|'high'|'medium', reasoning: string, severity: number }
 */
export const classifyIncidentPriority = async (incidentType, location, description = '') => {
  const result = await callAiTask('classifyIncidentPriority', {
    incidentType,
    location,
    description,
  });

  if (result?.priority) {
    return result;
  }

  const fallbackMap = { fire: 'critical', medical: 'high', security: 'medium' };
  const fallbackSeverity = { fire: 8, medical: 6, security: 4 };
  return {
    priority: fallbackMap[incidentType?.toLowerCase()] || 'medium',
    reasoning: 'Classified using default rules (AI unavailable)',
    severity: fallbackSeverity[incidentType?.toLowerCase()] || 5,
    recommended_actions: ['Dispatch nearest available staff', 'Notify admin on duty', 'Document incident details'],
  };
};

/**
 * Generate an EMS summary brief for first responders.
 * Used when an incident is escalated or flagged red.
 */
export const generateEMSBrief = async (incident) => {
  const result = await callAiTask('generateEMSBrief', { incident });

  if (result?.brief) {
    return result.brief;
  }

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
  const result = await callAiTask('getResponseRecommendations', {
    incident,
    availableStaff,
  });

  if (result?.recommendations) {
    return result;
  }

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
  const result = await callAiTask('analyzeRawIncident', {
    message,
    location,
  });

  if (result?.type) {
    return result;
  }

  return {
    type: 'other',
    priority: 'medium',
    severity: 5,
    keywords: ['incident', 'reported'],
    summary: `Guest reported an incident at ${location}.`,
    suggested_actions: ['Dispatch nearest available staff', 'Contact the guest for details', 'Monitor for escalation'],
  };
};
