import React, { createContext, useContext, useState, useEffect } from 'react';
import { assignPriority } from '../utils/priorityAssigner';
import { assignTaskToStaff } from '../utils/taskAssigner';

const DatabaseContext = createContext(null);

export const DatabaseProvider = ({ children }) => {
  // --- MOCK DATABASE STATE ---
  const [incidents, setIncidents] = useState([]);
  const [staff, setStaff] = useState([
    { id: 's1', name: 'John (Medical)', role: 'medical', isAvailable: true },
    { id: 's2', name: 'Sarah (Security)', role: 'security', isAvailable: true },
    { id: 's3', name: 'Mike (Fire)', role: 'fire', isAvailable: true },
    { id: 's4', name: 'Emma (Medical)', role: 'medical', isAvailable: false },
  ]);

  // --- ACTIONS ---
  
  // 1. Guest creates SOS
  const createIncident = (type, location) => {
    const priority = assignPriority(type);
    
    const newIncident = {
      id: `INC-${Date.now()}`,
      type,
      location,
      priority,
      status: 'active',
      timestamp: new Date().toISOString(),
      tasks: []
    };

    // Try to auto-assign
    const assignedStaffId = assignTaskToStaff(staff, type);
    
    if (assignedStaffId) {
      const newTask = {
        id: `TASK-${Date.now()}`,
        staff_id: assignedStaffId,
        role: type,
        status: 'pending',
        acknowledged: false,
        updated_at: new Date().toISOString()
      };
      
      newIncident.tasks.push(newTask);

      // Update staff availability instantly
      setStaff(prev => prev.map(s => 
        s.id === assignedStaffId ? { ...s, isAvailable: false } : s
      ));
    }

    setIncidents(prev => [newIncident, ...prev]);
    return newIncident;
  };

  // 2. Staff acknowledges task
  const acknowledgeTask = (incidentId, taskId) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          status: 'in_progress',
          tasks: inc.tasks.map(t => t.id === taskId ? { ...t, acknowledged: true, status: 'in_progress' } : t)
        };
      }
      return inc;
    }));
  };

  // 3. Staff completes task
  const completeTask = (incidentId, taskId, staffId) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          status: 'resolved',
          tasks: inc.tasks.map(t => t.id === taskId ? { ...t, status: 'done', updated_at: new Date().toISOString() } : t)
        };
      }
      return inc;
    }));

    // Free up staff
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, isAvailable: true } : s
    ));
  };

  // 4. Admin escalates incident (re-assign if possible, mark critical)
  const escalateIncident = (incidentId) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return { ...inc, priority: 'critical', status: 'active' };
      }
      return inc;
    }));
  };

  return (
    <DatabaseContext.Provider value={{
      incidents,
      staff,
      createIncident,
      acknowledgeTask,
      completeTask,
      escalateIncident
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

// Custom hooks to consume the "realtime" database
export const useRealtimeIncidents = () => {
  const context = useContext(DatabaseContext);
  return { incidents: context.incidents, createIncident: context.createIncident, escalateIncident: context.escalateIncident };
};

export const useStaffStatus = () => {
  const context = useContext(DatabaseContext);
  return { staff: context.staff };
};

export const useRealtimeTasks = (staffId) => {
  const context = useContext(DatabaseContext);
  
  // Filter incidents that have tasks assigned to this staff member
  const staffIncidents = context.incidents.filter(inc => 
    inc.tasks.some(t => t.staff_id === staffId && t.status !== 'done')
  );

  return { activeTasks: staffIncidents, acknowledgeTask: context.acknowledgeTask, completeTask: context.completeTask };
};
