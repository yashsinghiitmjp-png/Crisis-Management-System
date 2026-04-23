import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, push, set, onValue, update, get } from 'firebase/database';
import { db } from '../firebase';
import { classifyIncidentPriority, generateEMSBrief, getResponseRecommendations, analyzeRawIncident } from './geminiService';

const DatabaseContext = createContext(null);

export const DatabaseProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- REAL-TIME SUBSCRIPTIONS ---
  
  useEffect(() => {
    // Robustness fallback: If sync doesn't happen in 3s, show the dashboard anyway
    const syncTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // 1. Subscribe to Incidents
    const incidentsRef = ref(db, 'incidents');
    const unsubscribeIncidents = onValue(incidentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({
          id,
          ...val
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
        const defaultStaff = [
          { id: 's1', name: 'John (Medical)', role: 'medical', isAvailable: true },
          { id: 's2', name: 'Sarah (Security)', role: 'security', isAvailable: true },
          { id: 's3', name: 'Mike (Fire)', role: 'fire', isAvailable: true },
          { id: 's4', name: 'Emma (Medical)', role: 'medical', isAvailable: false },
        ];
        defaultStaff.forEach(s => {
          set(ref(db, `staff/${s.id}`), s);
        });
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

  const createIncident = async (type, location, description = '') => {
    const aiResult = await classifyIncidentPriority(type, location, description);

    const newIncidentData = {
      type,
      location,
      priority: aiResult.priority,
      aiReasoning: aiResult.reasoning,
      aiRecommendedActions: aiResult.recommended_actions || [],
      status: 'active',
      timestamp: new Date().toISOString(),
      tasks: [],
      emsBrief: null,
      aiRecommendations: null,
      rawMessage: description || `Triggered ${type} alert`,
      keywords: [],
      aiSummary: description || `Initial ${type} report at ${location}.`
    };

    const incidentsRef = ref(db, 'incidents');
    const newIncidentRef = push(incidentsRef);
    await set(newIncidentRef, newIncidentData);
    
    // Auto-assignment logic
    await autoAssignStaff(newIncidentRef.key, type);

    return { id: newIncidentRef.key, ...newIncidentData };
  };

  const createIncidentFromRaw = async (message, location) => {
    // 1. Analyze with Gemini
    const aiResult = await analyzeRawIncident(message, location);

    const newIncidentData = {
      type: aiResult.type || 'other',
      location,
      priority: aiResult.priority || 'medium',
      severity: aiResult.severity || 5,
      keywords: aiResult.keywords || [],
      aiSummary: aiResult.summary || message,
      aiRecommendedActions: aiResult.suggested_actions || [],
      rawMessage: message,
      aiReasoning: 'Structured from raw guest message by Gemini AI.',
      status: 'active',
      timestamp: new Date().toISOString(),
      tasks: [],
      emsBrief: null,
      aiRecommendations: null,
    };

    const incidentsRef = ref(db, 'incidents');
    const newIncidentRef = push(incidentsRef);
    await set(newIncidentRef, newIncidentData);
    
    // Auto-assignment
    await autoAssignStaff(newIncidentRef.key, newIncidentData.type);

    return { id: newIncidentRef.key, ...newIncidentData };
  };

  const autoAssignStaff = async (incidentId, type) => {
    const availableStaff = staff.find(s => s.isAvailable && s.role === type);
    if (availableStaff) {
      const taskId = `TASK-${Date.now()}`;
      const task = {
        id: taskId,
        staff_id: availableStaff.id,
        role: type,
        status: 'pending',
        acknowledged: false,
        updated_at: new Date().toISOString()
      };
      
      await update(ref(db, `incidents/${incidentId}`), {
        tasks: [task]
      });

      await update(ref(db, `staff/${availableStaff.id}`), {
        isAvailable: false
      });
    }
  };

  const acknowledgeTask = async (incidentId, taskId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      const updatedTasks = (incident.tasks || []).map(t => 
        t.id === taskId ? { ...t, acknowledged: true, status: 'in_progress' } : t
      );
      
      await update(incidentRef, {
        status: 'in_progress',
        tasks: updatedTasks
      });
    }
  };

  const completeTask = async (incidentId, taskId, staffId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      const updatedTasks = (incident.tasks || []).map(t => 
        t.id === taskId ? { ...t, status: 'done', updated_at: new Date().toISOString() } : t
      );
      
      await update(incidentRef, {
        status: 'resolved',
        tasks: updatedTasks
      });
    }

    await update(ref(db, `staff/${staffId}`), {
      isAvailable: true
    });
  };

  const escalateIncident = async (incidentId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      const brief = await generateEMSBrief({ id: incidentId, ...incident });
      
      await update(incidentRef, {
        priority: 'critical',
        status: 'active',
        emsBrief: brief
      });
    }
  };

  const getAIRecommendations = async (incidentId) => {
    const incidentRef = ref(db, `incidents/${incidentId}`);
    const snapshot = await get(incidentRef);
    if (snapshot.exists()) {
      const incident = snapshot.val();
      const recommendations = await getResponseRecommendations({ id: incidentId, ...incident }, staff);
      
      await update(incidentRef, {
        aiRecommendations: recommendations
      });
      return recommendations;
    }
    return null;
  };

  return (
    <DatabaseContext.Provider value={{
      incidents,
      staff,
      loading,
      createIncident,
      createIncidentFromRaw,
      acknowledgeTask,
      completeTask,
      escalateIncident,
      getAIRecommendations
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useRealtimeIncidents = () => {
  const context = useContext(DatabaseContext);
  return {
    incidents: context.incidents,
    loading: context.loading,
    createIncident: context.createIncident,
    createIncidentFromRaw: context.createIncidentFromRaw,
    escalateIncident: context.escalateIncident,
    getAIRecommendations: context.getAIRecommendations
  };
};

export const useStaffStatus = () => {
  const context = useContext(DatabaseContext);
  return { staff: context.staff };
};

export const useRealtimeTasks = (staffId) => {
  const context = useContext(DatabaseContext);
  
  const activeTasks = context.incidents.filter(inc => 
    (inc.tasks || []).some(t => t.staff_id === staffId && t.status !== 'done')
  );

  return { activeTasks, acknowledgeTask: context.acknowledgeTask, completeTask: context.completeTask };
};
