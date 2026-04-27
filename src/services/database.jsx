import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, push, set, onValue, update, get, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../firebase';
import {
  classifyIncidentPriority,
  generateEMSBrief,
  getResponseRecommendations,
  analyzeRawIncident,
} from './geminiService';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const DatabaseContext = createContext(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Append a timeline event to an incident (multi-path safe) */
const appendTimeline = (updates, incidentId, eventText) => {
  const timelineRef = ref(db, `incidents/${incidentId}/timeline`);
  const newKey = push(timelineRef).key;
  updates[`incidents/${incidentId}/timeline/${newKey}`] = {
    event: eventText,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Append a global log entry to /logs/{logId} (multi-path safe).
 * Severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success'
 * NOTE: timestamp is stored as a Unix ms number so orderByChild('timestamp') works.
 */
const appendLog = (updates, { type, incidentId = null, message, userId = null, staffId = null, severity = 'info' }) => {
  const logRef = ref(db, 'logs');
  const newKey = push(logRef).key;
  const entry = {
    type,
    incidentId,
    message,
    userId,
    staffId,
    severity,
    timestamp: Date.now(),  // numeric — required for orderByChild to sort correctly
  };
  updates[`logs/${newKey}`] = entry;
  // ── DEBUG: confirm the key was generated and the path is correct ──
  console.log(`[CMS:LOG] Queued log → logs/${newKey}`, entry);
};

const clampSeverity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(1, Math.min(10, Math.round(numeric)));
};

const fallbackSeverityFromPriority = (priority) => {
  switch (priority) {
    case 'critical':
      return 9;
    case 'high':
      return 7;
    case 'medium':
      return 4;
    case 'low':
      return 2;
    default:
      return 5;
  }
};

const resolveIncidentSeverity = (incident) => {
  const explicitSeverity = clampSeverity(incident?.severity);
  if (explicitSeverity) return explicitSeverity;

  if (incident?.aiRecommendations?.escalation_needed) {
    return Math.max(8, fallbackSeverityFromPriority(incident?.priority));
  }

  return fallbackSeverityFromPriority(incident?.priority);
};

const resolveEscalationMode = (incident) => {
  if (incident?.escalationMode) return incident.escalationMode;
  const severity = resolveIncidentSeverity(incident);
  return severity >= 8 || incident?.priority === 'critical' ? 'ai_auto' : 'admin_review';
};

const shouldAutoEscalateIncident = (incident) => {
  if (!incident || incident.priority === 'critical' || incident.status === 'resolved') {
    return false;
  }

  const severity = resolveIncidentSeverity(incident);
  const aiRequestsEscalation = incident.aiRecommendations?.escalation_needed === true;
  const hasNoAssignment =
    !incident.tasks ||
    Object.keys(incident.tasks).length === 0 ||
    Object.values(incident.tasks).some((task) => task?.status === 'pending_assignment');

  return resolveEscalationMode(incident) === 'ai_auto' && (
    severity >= 8 ||
    aiRequestsEscalation ||
    (hasNoAssignment && severity >= 7)
  );
};

/** Convert tasks object (keyed) → sorted array for rendering */
const tasksObjectToArray = (tasksObj) => {
  if (!tasksObj) return [];
  if (Array.isArray(tasksObj)) {
    // Backwards-compat: if old array format still in DB convert it
    return tasksObj;
  }
  return Object.entries(tasksObj).map(([id, v]) => ({ id, ...v }));
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const DatabaseProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- REAL-TIME SUBSCRIPTIONS ---
  useEffect(() => {
    // Fallback: if sync doesn't happen in 3 s, unblock dashboards anyway
    const syncTimeout = setTimeout(() => setLoading(false), 3000);

    // 1. Subscribe to Incidents (Admin sees all; guests/staff use focused hooks)
    const incidentsRef = ref(db, 'incidents');
    const unsubscribeIncidents = onValue(incidentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({
            id,
            ...val,
            tasks: tasksObjectToArray(val.tasks),
            timeline: val.timeline
              ? Object.values(val.timeline).sort(
                  (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                )
              : [],
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setIncidents(list);
      } else {
        setIncidents([]);
      }
      setLoading(false);
      clearTimeout(syncTimeout);
    });

    // 2. Subscribe to Staff
    const staffRef = ref(db, 'staff');
    const unsubscribeStaff = onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStaff(Object.values(data));
      } else {
        setStaff([]);
      }
      setLoading(false);
      clearTimeout(syncTimeout);
    });

    return () => {
      unsubscribeIncidents();
      unsubscribeStaff();
      clearTimeout(syncTimeout);
    };
  }, []);

  // --- ACTIONS ---

  /** Create a typed incident (quick-tap flow) */
  const createIncident = useCallback(async (type, location, description = '', userId = null) => {
    const now = new Date().toISOString();

    // ── Step 1: AI classification (OPTIONAL — never blocks a write) ──
    let aiResult = {
      priority: 'medium',
      reasoning: 'AI classification unavailable — default priority applied.',
      recommended_actions: [],
      severity: 5,
    };
    try {
      const rawAI = await classifyIncidentPriority(type, location, description);
      if (rawAI && rawAI.priority) {
        aiResult = rawAI;
        console.log('[CMS] AI classification succeeded:', aiResult);
      } else {
        console.warn('[CMS] AI returned unexpected shape, using fallback:', rawAI);
      }
    } catch (aiErr) {
      console.error('[CMS] AI classification failed — falling back to medium priority:', aiErr);
    }

    // ── Step 2: Build incident object ──
    const newIncidentData = {
      type,
      location,
      priority: aiResult.priority,
      aiReasoning: aiResult.reasoning,
      aiRecommendedActions: aiResult.recommended_actions || [],
      status: 'active',
      timestamp: now,
      tasks: {},
      // Note: Firebase ignores an empty {} node — the tasks sub-tree is
      // created on first child write (autoAssignStaff). This is intentional.
      emsBrief: null,
      aiRecommendations: null,
      rawMessage: description || `Triggered ${type} alert`,
      keywords: [],
      aiSummary: description || `Initial ${type} report at ${location}.`,
      severity: clampSeverity(aiResult.severity) || fallbackSeverityFromPriority(aiResult.priority),
      escalationMode:
        (clampSeverity(aiResult.severity) || fallbackSeverityFromPriority(aiResult.priority)) >= 8 ||
        aiResult.priority === 'critical'
          ? 'ai_auto'
          : 'admin_review',
      ...(userId ? { userId } : {}),
    };

    // ── Step 3: Generate Firebase key ──
    const incidentsRef = ref(db, 'incidents');
    const newIncidentRef = push(incidentsRef);
    const incidentId = newIncidentRef.key;

    // ── Step 4: Build multi-path update payload ──
    // IMPORTANT: we write the incident fields individually (NOT as a nested object)
    // to prevent Firebase from silently dropping the batch when a sub-node is empty.
    const updates = {};
    updates[`incidents/${incidentId}/type`]                 = newIncidentData.type;
    updates[`incidents/${incidentId}/location`]             = newIncidentData.location;
    updates[`incidents/${incidentId}/priority`]             = newIncidentData.priority;
    updates[`incidents/${incidentId}/aiReasoning`]          = newIncidentData.aiReasoning;
    updates[`incidents/${incidentId}/aiRecommendedActions`] = newIncidentData.aiRecommendedActions;
    updates[`incidents/${incidentId}/status`]               = 'active';
    updates[`incidents/${incidentId}/timestamp`]            = newIncidentData.timestamp;
    updates[`incidents/${incidentId}/emsBrief`]             = null;
    updates[`incidents/${incidentId}/aiRecommendations`]    = null;
    updates[`incidents/${incidentId}/rawMessage`]           = newIncidentData.rawMessage;
    updates[`incidents/${incidentId}/keywords`]             = [];
    updates[`incidents/${incidentId}/aiSummary`]            = newIncidentData.aiSummary;
    updates[`incidents/${incidentId}/severity`]             = newIncidentData.severity;
    updates[`incidents/${incidentId}/escalationMode`]       = newIncidentData.escalationMode;
    if (userId) updates[`incidents/${incidentId}/userId`]   = userId;
    appendTimeline(updates, incidentId, `Incident created: ${type.toUpperCase()} at ${location}`);
    appendLog(updates, {
      type: 'incident_created',
      incidentId,
      message: `New ${type.toUpperCase()} incident created at ${location} [Priority: ${aiResult.priority}]`,
      userId,
      severity: aiResult.priority === 'critical' ? 'critical' : aiResult.priority === 'high' ? 'high' : 'medium',
    });
    if (userId) {
      updates[`incidents_by_user/${userId}/${incidentId}`] = {
        status: 'active',
        priority: aiResult.priority,
        type,
        timestamp: now,
      };
    }

    // ── Step 5: Write to Firebase (guarded) ──
    console.log(`[CMS] Writing incident ${incidentId} to Firebase. Paths:`, Object.keys(updates));
    try {
      await update(ref(db), updates);
      console.log(`[CMS] ✅ Incident ${incidentId} written successfully.`);
    } catch (writeErr) {
      console.error(`[CMS] ❌ Firebase write FAILED for incident ${incidentId}:`, writeErr);
      throw writeErr; // re-throw so GuestDashboard can show an error state
    }

    // ── Step 6: Auto-assign staff (non-blocking failure) ──
    try {
      await autoAssignStaff(incidentId, type, location, aiResult.priority, userId);
    } catch (assignErr) {
      console.error(`[CMS] Auto-assign failed for ${incidentId} — incident still saved:`, assignErr);
    }

    // ── Step 7: Auto-fetch AI Recommendations (non-blocking) ──
    getAIRecommendations(incidentId).catch(err => {
      console.error(`[CMS] Auto-fetch AI Recommendations failed for ${incidentId}:`, err);
    });

    return { id: incidentId, ...newIncidentData };
  }, [staff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Create incident from free-text (AI-analysed flow) */
  const createIncidentFromRaw = useCallback(async (message, location, userId = null) => {
    const now = new Date().toISOString();

    // ── Step 1: AI raw analysis (OPTIONAL — never blocks a write) ──
    let aiResult = {
      type: 'other',
      priority: 'medium',
      severity: 5,
      keywords: [],
      summary: message,
      suggested_actions: [],
    };
    try {
      const rawAI = await analyzeRawIncident(message, location);
      if (rawAI && rawAI.type) {
        aiResult = rawAI;
        console.log('[CMS] Raw AI analysis succeeded:', aiResult);
      } else {
        console.warn('[CMS] Raw AI returned unexpected shape, using fallback:', rawAI);
      }
    } catch (aiErr) {
      console.error('[CMS] Raw AI analysis failed — falling back to defaults:', aiErr);
    }

    // ── Step 2: Build incident object ──
    const newIncidentData = {
      type: aiResult.type || 'other',
      location,
      priority: aiResult.priority || 'medium',
      severity: clampSeverity(aiResult.severity) || fallbackSeverityFromPriority(aiResult.priority),
      keywords: aiResult.keywords || [],
      aiSummary: aiResult.summary || message,
      aiRecommendedActions: aiResult.suggested_actions || [],
      rawMessage: message,
      aiReasoning: 'Structured from raw guest message by Gemini AI.',
      status: 'active',
      timestamp: now,
      tasks: {},
      emsBrief: null,
      aiRecommendations: null,
      escalationMode:
        (clampSeverity(aiResult.severity) || fallbackSeverityFromPriority(aiResult.priority)) >= 8 ||
        (aiResult.priority || 'medium') === 'critical'
          ? 'ai_auto'
          : 'admin_review',
      ...(userId ? { userId } : {}),
    };

    // ── Step 3: Generate Firebase key ──
    const incidentsRef = ref(db, 'incidents');
    const newIncidentRef = push(incidentsRef);
    const incidentId = newIncidentRef.key;

    // ── Step 4: Build multi-path update payload ──
    // IMPORTANT: write fields individually — do NOT spread the object.
    // Spreading an object with nested empty {} causes Firebase to ignore the entire node.
    const updates = {};
    updates[`incidents/${incidentId}/type`]                 = newIncidentData.type;
    updates[`incidents/${incidentId}/location`]             = location;
    updates[`incidents/${incidentId}/priority`]             = newIncidentData.priority;
    updates[`incidents/${incidentId}/severity`]             = newIncidentData.severity;
    updates[`incidents/${incidentId}/keywords`]             = newIncidentData.keywords;
    updates[`incidents/${incidentId}/aiSummary`]            = newIncidentData.aiSummary;
    updates[`incidents/${incidentId}/aiRecommendedActions`] = newIncidentData.aiRecommendedActions;
    updates[`incidents/${incidentId}/rawMessage`]           = message;
    updates[`incidents/${incidentId}/aiReasoning`]          = newIncidentData.aiReasoning;
    updates[`incidents/${incidentId}/status`]               = 'active';
    updates[`incidents/${incidentId}/timestamp`]            = now;
    updates[`incidents/${incidentId}/emsBrief`]             = null;
    updates[`incidents/${incidentId}/aiRecommendations`]    = null;
    updates[`incidents/${incidentId}/escalationMode`]       = newIncidentData.escalationMode;
    if (userId) updates[`incidents/${incidentId}/userId`]   = userId;

    appendTimeline(updates, incidentId, `Incident created from report: ${newIncidentData.type.toUpperCase()} at ${location}`);
    // ── appendLog was missing here — this was a primary reason logs didn't appear ──
    appendLog(updates, {
      type: 'incident_created',
      incidentId,
      message: `New ${newIncidentData.type.toUpperCase()} raw incident at ${location} [Priority: ${newIncidentData.priority}]`,
      userId,
      severity: newIncidentData.priority === 'critical' ? 'critical' : newIncidentData.priority === 'high' ? 'high' : 'medium',
    });
    if (userId) {
      updates[`incidents_by_user/${userId}/${incidentId}`] = {
        status: 'active',
        priority: newIncidentData.priority,
        type: newIncidentData.type,
        timestamp: now,
      };
    }

    // ── Step 5: Write to Firebase (guarded) ──
    console.log(`[CMS] Writing raw incident ${incidentId} to Firebase. Paths:`, Object.keys(updates));
    try {
      await update(ref(db), updates);
      console.log(`[CMS] ✅ Raw incident ${incidentId} written successfully.`);
    } catch (writeErr) {
      console.error(`[CMS] ❌ Firebase write FAILED for raw incident ${incidentId}:`, writeErr);
      throw writeErr;
    }

    // ── Step 6: Auto-assign staff (non-blocking failure) ──
    try {
      await autoAssignStaff(incidentId, newIncidentData.type, location, newIncidentData.priority, userId);
    } catch (assignErr) {
      console.error(`[CMS] Auto-assign failed for ${incidentId} — incident still saved:`, assignErr);
    }

    // ── Step 7: Auto-fetch AI Recommendations (non-blocking) ──
    getAIRecommendations(incidentId).catch(err => {
      console.error(`[CMS] Auto-fetch AI Recommendations failed for ${incidentId}:`, err);
    });

    return { id: incidentId, ...newIncidentData };
  }, [staff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Internal: auto-assign available staff and write tasks_by_staff index.
   *  Fully guarded — caller should wrap in try/catch. */
  const autoAssignStaff = async (incidentId, type, location, priority, userId = null) => {
    // Re-fetch current staff state from DB to avoid stale closure
    const staffSnap = await get(ref(db, 'staff'));
    const staffData = staffSnap.val() || {};
    const staffList = Object.values(staffData);

    // Load balancing: prefer staff who were least recently assigned
    const availableStaff = staffList
      .filter((s) => s.isAvailable === true && s.role === type)
      .sort((a, b) => (a.lastAssignedAt || 0) - (b.lastAssignedAt || 0))[0];

    const taskId = `TASK-${Date.now()}`;
    const now = new Date().toISOString();

    const updates = {};

    if (availableStaff) {
      const task = {
        id: taskId,
        staff_id: availableStaff.id,
        staff_name: availableStaff.name,
        role: type,
        status: 'pending',
        acknowledged: false,
        updated_at: now,
      };

      // Record assigned time at the incident level
      updates[`incidents/${incidentId}/assignedAt`] = now;

      // Write task on incident (keyed)
      updates[`incidents/${incidentId}/tasks/${taskId}`] = task;

      // Write tasks_by_staff index
      updates[`tasks_by_staff/${availableStaff.id}/${taskId}`] = {
        incidentId,
        type,
        location,
        priority,
        status: 'pending',
        acknowledged: false,
        updated_at: now,
      };

      // Update user index status
      if (userId) {
        updates[`incidents_by_user/${userId}/${incidentId}/status`] = 'assigned';
      }

      // Mark staff unavailable and record last assigned time
      updates[`staff/${availableStaff.id}/isAvailable`] = false;
      updates[`staff/${availableStaff.id}/lastAssignedAt`] = Date.now();

      appendTimeline(updates, incidentId, `Assigned to ${availableStaff.name}`);
      appendLog(updates, {
        type: 'task_assigned',
        incidentId,
        message: `${availableStaff.name} assigned to ${type.toUpperCase()} incident`,
        staffId: availableStaff.id,
        severity: priority === 'critical' ? 'critical' : 'info',
      });
    } else {
      const task = {
        id: taskId,
        staff_id: null,
        staff_name: null,
        role: type,
        status: 'pending_assignment',
        acknowledged: false,
        updated_at: now,
      };
      updates[`incidents/${incidentId}/tasks/${taskId}`] = task;
      appendTimeline(updates, incidentId, `No ${type} staff available — awaiting manual assignment`);
      appendLog(updates, {
        type: 'task_unassigned',
        incidentId,
        message: `No ${type.toUpperCase()} staff available — manual assignment required`,
        severity: 'high',
      });
    }

    const updatePaths = Object.keys(updates);
    console.log(`[CMS:DB] autoAssignStaff writing ${updatePaths.length} paths:`, updatePaths);
    try {
      await update(ref(db), updates);
      console.log('[CMS:DB] autoAssignStaff ✅ write succeeded.');
    } catch (err) {
      console.error('[CMS:DB] autoAssignStaff ❌ WRITE FAILED:', err.code, err.message, '\nPaths attempted:', updatePaths);
      throw err;
    }
  };

  /** Staff: Acknowledge a task (pending → acknowledged) */
  const acknowledgeTask = useCallback(async (incidentId, taskId, staffId) => {
    const now = new Date().toISOString();
    const updates = {};

    updates[`incidents/${incidentId}/tasks/${taskId}/acknowledged`] = true;
    updates[`incidents/${incidentId}/tasks/${taskId}/status`] = 'acknowledged';
    updates[`incidents/${incidentId}/tasks/${taskId}/updated_at`] = now;
    updates[`incidents/${incidentId}/status`] = 'in_progress';

    if (staffId) {
      updates[`tasks_by_staff/${staffId}/${taskId}/acknowledged`] = true;
      updates[`tasks_by_staff/${staffId}/${taskId}/status`] = 'acknowledged';
      updates[`tasks_by_staff/${staffId}/${taskId}/updated_at`] = now;
    }

    // Update guest user index if we have the incident's userId
    const incSnap = await get(ref(db, `incidents/${incidentId}/userId`));
    const userId = incSnap.val();
    if (userId) {
      updates[`incidents_by_user/${userId}/${incidentId}/status`] = 'in_progress';
    }

    appendTimeline(updates, incidentId, 'Task acknowledged — responder en route');
    appendLog(updates, {
      type: 'task_acknowledged',
      incidentId,
      message: `Task ${taskId} acknowledged — responder en route`,
      staffId: staffId || null,
      severity: 'info',
    });
    await update(ref(db), updates);
  }, []);

  /** Staff: Start working (acknowledged → in_progress) */
  const startTask = useCallback(async (incidentId, taskId, staffId) => {
    const now = new Date().toISOString();
    const updates = {};

    updates[`incidents/${incidentId}/startedAt`] = now;
    updates[`incidents/${incidentId}/tasks/${taskId}/status`] = 'in_progress';
    updates[`incidents/${incidentId}/tasks/${taskId}/updated_at`] = now;

    if (staffId) {
      updates[`tasks_by_staff/${staffId}/${taskId}/status`] = 'in_progress';
      updates[`tasks_by_staff/${staffId}/${taskId}/updated_at`] = now;
    }

    appendTimeline(updates, incidentId, 'Responder on scene — handling incident');
    appendLog(updates, {
      type: 'task_in_progress',
      incidentId,
      message: `Responder on scene — handling incident (task ${taskId})`,
      staffId: staffId || null,
      severity: 'info',
    });
    await update(ref(db), updates);
  }, []);

  /** Staff: Complete a task (in_progress → done) */
  const completeTask = useCallback(async (incidentId, taskId, staffId) => {
    const now = new Date().toISOString();
    const updates = {};

    updates[`incidents/${incidentId}/tasks/${taskId}/status`] = 'done';
    updates[`incidents/${incidentId}/tasks/${taskId}/updated_at`] = now;

    if (staffId) {
      updates[`tasks_by_staff/${staffId}/${taskId}/status`] = 'done';
      updates[`tasks_by_staff/${staffId}/${taskId}/updated_at`] = now;
      // Free up staff
      updates[`staff/${staffId}/isAvailable`] = true;
    }

    appendTimeline(updates, incidentId, 'Task completed by responder');
    appendLog(updates, {
      type: 'task_completed',
      incidentId,
      message: `Task ${taskId} completed by responder`,
      staffId: staffId || null,
      severity: 'success',
    });
    await update(ref(db), updates);
  }, []);

  /** Staff: Request escalation support or backup from admin */
  const requestBackup = useCallback(async (incidentId, taskId, staffId) => {
    const now = new Date().toISOString();
    const incidentSnap = await get(ref(db, `incidents/${incidentId}`));
    if (!incidentSnap.exists()) return;

    const incident = incidentSnap.val();
    const taskSnap = staffId ? await get(ref(db, `tasks_by_staff/${staffId}/${taskId}`)) : null;
    const task = taskSnap?.val() || {};
    const updates = {};

    updates[`incidents/${incidentId}/backupRequested`] = true;
    updates[`incidents/${incidentId}/backupRequestedAt`] = now;
    updates[`incidents/${incidentId}/backupRequestedBy`] = staffId || null;

    if (!incident.escalationMode || incident.escalationMode === 'ai_auto') {
      updates[`incidents/${incidentId}/escalationMode`] = 'admin_review';
    }

    if (taskId) {
      updates[`incidents/${incidentId}/tasks/${taskId}/backup_requested`] = true;
      updates[`incidents/${incidentId}/tasks/${taskId}/backup_requested_at`] = now;
    }

    if (staffId && taskId) {
      updates[`tasks_by_staff/${staffId}/${taskId}/backup_requested`] = true;
      updates[`tasks_by_staff/${staffId}/${taskId}/backup_requested_at`] = now;
    }

    appendTimeline(
      updates,
      incidentId,
      `Responder requested escalation support${task.staff_name ? `: ${task.staff_name}` : ''}`
    );
    appendLog(updates, {
      type: 'backup_requested',
      incidentId,
      message: `Responder requested backup support for ${incident.type?.toUpperCase() || 'incident'}`,
      staffId: staffId || null,
      severity: incident.priority === 'critical' ? 'critical' : 'high',
    });
    await update(ref(db), updates);
  }, []);

  /** Admin: Escalate incident to critical */
  const escalateIncident = useCallback(async (incidentId, source = 'admin') => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      if (incident.priority === 'critical') return;
      const brief = await generateEMSBrief({ id: incidentId, ...incident });
      const updates = {};
      updates[`incidents/${incidentId}/priority`] = 'critical';
      updates[`incidents/${incidentId}/status`] = 'active';
      updates[`incidents/${incidentId}/emsBrief`] = brief;
      appendTimeline(
        updates,
        incidentId,
        source === 'ai_auto'
          ? 'Incident escalated to CRITICAL automatically by AI backup policy'
          : 'Incident escalated to CRITICAL by admin'
      );
      appendLog(updates, {
        type: 'incident_escalated',
        incidentId,
        message:
          source === 'ai_auto'
            ? 'Priority escalated to CRITICAL automatically by AI backup policy.'
            : 'Priority escalated to CRITICAL by admin command.',
        severity: 'critical',
      });
      await update(ref(db), updates);
    }
  }, []);

  const updateEscalationMode = useCallback(async (incidentId, escalationMode) => {
    const incidentSnap = await get(ref(db, `incidents/${incidentId}`));
    const incident = incidentSnap.val();
    if (!incident) return;

    const updates = {};
    updates[`incidents/${incidentId}/escalationMode`] = escalationMode;
    appendTimeline(
      updates,
      incidentId,
      escalationMode === 'ai_auto'
        ? 'Escalation mode set to AI AUTO backup'
        : 'Escalation mode set to ADMIN REVIEW'
    );
    appendLog(updates, {
      type: 'escalation_mode_change',
      incidentId,
      message:
        escalationMode === 'ai_auto'
          ? 'Escalation mode changed to AI AUTO backup.'
          : 'Escalation mode changed to ADMIN REVIEW.',
      severity: escalationMode === 'ai_auto' ? 'high' : 'info',
    });
    await update(ref(db), updates);
  }, []);

  const updatePriority = useCallback(async (incidentId, priority) => {
    const updates = {};
    updates[`incidents/${incidentId}/priority`] = priority;
    appendTimeline(updates, incidentId, `Priority changed to ${priority.toUpperCase()} by admin`);
    appendLog(updates, {
      type: 'priority_change',
      incidentId,
      message: `Priority manually adjusted to ${priority.toUpperCase()}`,
      severity: priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'info',
    });
    await update(ref(db), updates);
  }, []);

  /** Admin: Get AI recommendations and store them */
  const getAIRecommendations = useCallback(async (incidentId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      const recommendations = await getResponseRecommendations(
        { id: incidentId, ...incident },
        staff
      );
      console.log('[CMS:AI] Received recommendations:', recommendations);
      const severity = resolveIncidentSeverity({ ...incident, aiRecommendations: recommendations });
      const payload = {
        ...recommendations,
        refreshedAt: new Date().toISOString(),
        refreshCount: (incident.aiRecommendations?.refreshCount || 0) + 1,
      };
      await update(ref(db, `incidents/${incidentId}`), {
        aiRecommendations: payload,
        severity,
        escalationMode: incident.escalationMode || resolveEscalationMode({ ...incident, severity }),
      });
      return payload;
    }
    return null;
  }, [staff]);

  /** Admin: Manually assign staff to a task */
  const manualAssignStaff = useCallback(async (incidentId, taskId, staffId, role) => {
    const assignedStaff = staff.find((s) => s.id === staffId);
    if (!assignedStaff) return;

    const now = new Date().toISOString();
    const resolvedTaskId = taskId || `TASK-${Date.now()}`;

    // Get incident location + priority for index
    const incSnap = await get(ref(db, `incidents/${incidentId}`));
    const inc = incSnap.val() || {};

    const updates = {};
    updates[`incidents/${incidentId}/tasks/${resolvedTaskId}`] = {
      id: resolvedTaskId,
      staff_id: staffId,
      staff_name: assignedStaff.name,
      role,
      status: 'pending',
      acknowledged: false,
      updated_at: now,
    };
    updates[`tasks_by_staff/${staffId}/${resolvedTaskId}`] = {
      incidentId,
      type: inc.type || role,
      location: inc.location || '',
      priority: inc.priority || 'medium',
      status: 'pending',
      acknowledged: false,
      updated_at: now,
    };
    updates[`staff/${staffId}/isAvailable`] = false;
    updates[`staff/${staffId}/lastAssignedAt`] = Date.now();

    updates[`incidents/${incidentId}/assignedAt`] = now;

    // Update guest user index
    if (inc.userId) {
      updates[`incidents_by_user/${inc.userId}/${incidentId}/status`] = 'assigned';
    }

    appendTimeline(updates, incidentId, `Manually assigned to ${assignedStaff.name} by admin`);
    appendLog(updates, {
      type: 'task_assigned',
      incidentId,
      message: `Admin manually assigned ${assignedStaff.name} to task`,
      staffId,
      severity: inc.priority === 'critical' ? 'critical' : 'info',
    });
    await update(ref(db), updates);
  }, [staff]);

  /** Admin: Reassign staff to a task */
  const manualReassignStaff = useCallback(async (incidentId, taskId, newStaffId, oldStaffId) => {
    const newAssignedStaff = staff.find((s) => s.id === newStaffId);
    if (!newAssignedStaff) return;

    const now = new Date().toISOString();
    const incSnap = await get(ref(db, `incidents/${incidentId}`));
    const inc = incSnap.val() || {};

    const updates = {};
    updates[`incidents/${incidentId}/tasks/${taskId}/staff_id`] = newStaffId;
    updates[`incidents/${incidentId}/tasks/${taskId}/staff_name`] = newAssignedStaff.name;
    updates[`incidents/${incidentId}/tasks/${taskId}/status`] = 'pending';
    updates[`incidents/${incidentId}/tasks/${taskId}/acknowledged`] = false;
    updates[`incidents/${incidentId}/tasks/${taskId}/updated_at`] = now;

    // Update index for new staff
    updates[`tasks_by_staff/${newStaffId}/${taskId}`] = {
      incidentId,
      type: inc.type || '',
      location: inc.location || '',
      priority: inc.priority || 'medium',
      status: 'pending',
      acknowledged: false,
      updated_at: now,
    };

    updates[`staff/${newStaffId}/isAvailable`] = false;

    if (oldStaffId) {
      // Remove old index entry
      updates[`tasks_by_staff/${oldStaffId}/${taskId}`] = null;
      updates[`staff/${oldStaffId}/isAvailable`] = true;
    }

    updates[`staff/${newStaffId}/lastAssignedAt`] = Date.now();
    updates[`incidents/${incidentId}/assignedAt`] = now;

    appendTimeline(updates, incidentId, `Reassigned from ${oldStaffId} to ${newAssignedStaff.name} by admin`);
    appendLog(updates, {
      type: 'task_reassigned',
      incidentId,
      message: `Task reassigned to ${newAssignedStaff.name}`,
      staffId: newStaffId,
      severity: 'warning',
    });
    await update(ref(db), updates);
  }, [staff]);

  /** Admin: Force-resolve entire incident */
  const forceResolveIncident = useCallback(async (incidentId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (!snapshot.exists()) return;

    const incident = snapshot.val();
    const now = new Date().toISOString();
    const updates = {};

    updates[`incidents/${incidentId}/status`] = 'resolved';
    updates[`incidents/${incidentId}/resolvedAt`] = now;

    // Free all assigned staff
    const tasks = incident.tasks || {};
    const taskEntries = Array.isArray(tasks)
      ? tasks
      : Object.entries(tasks).map(([id, v]) => ({ id, ...v }));

    taskEntries.forEach((t) => {
      if (t.staff_id) {
        updates[`staff/${t.staff_id}/isAvailable`] = true;
        updates[`tasks_by_staff/${t.staff_id}/${t.id}/status`] = 'done';
        updates[`tasks_by_staff/${t.staff_id}/${t.id}/updated_at`] = now;
      }
      updates[`incidents/${incidentId}/tasks/${t.id}/status`] = 'done';
      updates[`incidents/${incidentId}/tasks/${t.id}/updated_at`] = now;
    });

    // Update guest user index
    if (incident.userId) {
      updates[`incidents_by_user/${incident.userId}/${incidentId}/status`] = 'resolved';
    }

    appendTimeline(updates, incidentId, 'Incident resolved by admin');
    appendLog(updates, {
      type: 'incident_resolved',
      incidentId,
      message: `Incident resolved by admin`,
      severity: 'success',
    });
    await update(ref(db), updates);
  }, []);

  useEffect(() => {
    if (!incidents.length) return undefined;

    const interval = setInterval(() => {
      incidents.forEach((incident) => {
        if (shouldAutoEscalateIncident(incident)) {
          console.warn(`[CMS] Auto-escalating incident ${incident.id} via AI auto mode.`);
          escalateIncident(incident.id, 'ai_auto');
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [incidents, escalateIncident]);

  return (
    <DatabaseContext.Provider
      value={{
        incidents,
        staff,
        loading,
        createIncident,
        createIncidentFromRaw,
        acknowledgeTask,
        startTask,
        completeTask,
        requestBackup,
        escalateIncident,
        updateEscalationMode,
        updatePriority,
        getAIRecommendations,
        manualAssignStaff,
        manualReassignStaff,
        forceResolveIncident,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Admin hook — full incident list + all actions */
export const useRealtimeIncidents = () => {
  const context = useContext(DatabaseContext);
  return {
    incidents: context.incidents,
    loading: context.loading,
    createIncident: context.createIncident,
    createIncidentFromRaw: context.createIncidentFromRaw,
    escalateIncident: context.escalateIncident,
    updateEscalationMode: context.updateEscalationMode,
    updatePriority: context.updatePriority,
    getAIRecommendations: context.getAIRecommendations,
    manualAssignStaff: context.manualAssignStaff,
    manualReassignStaff: context.manualReassignStaff,
    forceResolveIncident: context.forceResolveIncident,
  };
};

/** Staff hook — subscribes ONLY to /tasks_by_staff/{staffId} for this user */
export const useRealtimeTasks = (staffId) => {
  const [myTasks, setMyTasks] = useState([]);
  const context = useContext(DatabaseContext);

  useEffect(() => {
    if (!staffId) {
      setMyTasks([]);
      return;
    }
    const tasksRef = ref(db, `tasks_by_staff/${staffId}`);
    const unsub = onValue(tasksRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([taskId, val]) => ({ taskId, ...val }))
          .filter((t) => t.status !== 'done')
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setMyTasks(list);
      } else {
        setMyTasks([]);
      }
    });
    return () => unsub();
  }, [staffId]);

  useEffect(() => {
    if (!myTasks.length) return;

    const enrichedTasks = myTasks.map((task) => {
      const incident = context.incidents.find((inc) => inc.id === task.incidentId);
      if (!incident) return task;

      return {
        ...task,
        incidentStatus: incident.status,
        incidentSeverity: incident.severity,
        incidentSummary: incident.aiSummary,
        incidentKeywords: incident.keywords || [],
        incidentRecommendations: incident.aiRecommendations || null,
        incidentRecommendedActions: incident.aiRecommendedActions || [],
        incidentEscalationMode: incident.escalationMode || null,
        incidentEmsBrief: incident.emsBrief || null,
        incidentCreatedAt: incident.timestamp || null,
      };
    });

    const changed =
      enrichedTasks.length !== myTasks.length ||
      enrichedTasks.some((task, index) => JSON.stringify(task) !== JSON.stringify(myTasks[index]));

    if (changed) {
      setMyTasks(enrichedTasks);
    }
  }, [context.incidents, myTasks]);

  return {
    myTasks,
    acknowledgeTask: context.acknowledgeTask,
    startTask: context.startTask,
    completeTask: context.completeTask,
    requestBackup: context.requestBackup,
  };
};

/** Guest hook — subscribes ONLY to /incidents_by_user/{userId}/{incidentId} for live status */
export const useMyIncident = (userId, incidentId) => {
  const [incidentStatus, setIncidentStatus] = useState(null);

  useEffect(() => {
    if (!userId || !incidentId) {
      setIncidentStatus(null);
      return;
    }
    const incRef = ref(db, `incidents_by_user/${userId}/${incidentId}`);
    const unsub = onValue(incRef, (snap) => {
      if (snap.exists()) {
        setIncidentStatus(snap.val());
      }
    });
    return () => unsub();
  }, [userId, incidentId]);

  return incidentStatus;
};

/** Staff status hook for Admin */
export const useStaffStatus = () => {
  const context = useContext(DatabaseContext);
  return { staff: context.staff };
};

/**
 * Global log stream hook — subscribes to /logs ordered by timestamp.
 * Limited to the last MAX_LOGS entries via Firebase limitToLast query.
 * Never causes re-renders in other hooks — standalone subscription.
 */
const MAX_LOGS = 100;

export const useRealtimeLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // limitToLast(100) — Firebase only streams the most recent 100 log entries.
    // orderByChild('timestamp') requires an index in Firebase rules (see below).
    const logsRef = query(
      ref(db, 'logs'),
      orderByChild('timestamp'),
      limitToLast(MAX_LOGS)
    );

    const unsub = onValue(logsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          // Sort by numeric timestamp (newest first)
          .sort((a, b) => b.timestamp - a.timestamp);
        setLogs(list);
      } else {
        setLogs([]);
      }
    });

    return () => unsub();
  }, []);

  return logs;
};
