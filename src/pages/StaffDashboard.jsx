import React, { useState } from 'react';
import { useRealtimeTasks } from '../services/mockDatabase';
import PriorityTag from '../components/shared/PriorityTag';
import { MapPin, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const StaffDashboard = () => {
  // Hardcoded for prototype: impersonating 'John (Medical)' staff s1
  const [currentStaffId, setCurrentStaffId] = useState('s1'); 
  
  const { activeTasks, acknowledgeTask, completeTask } = useRealtimeTasks(currentStaffId);

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>My Active Tasks</h1>
          <p>Impersonating Staff ID: {currentStaffId}</p>
        </div>
        
        {/* Mock auth selector for testing */}
        <select 
          value={currentStaffId} 
          onChange={(e) => setCurrentStaffId(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'white', border: '1px solid var(--border-light)' }}
        >
          <option value="s1">John (Medical) [s1]</option>
          <option value="s2">Sarah (Security) [s2]</option>
          <option value="s3">Mike (Fire) [s3]</option>
        </select>
      </div>

      <div className="grid gap-4">
        {activeTasks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>You have no active assignments.</p>
          </div>
        ) : (
          activeTasks.map(incident => {
            const myTask = incident.tasks.find(t => t.staff_id === currentStaffId && t.status !== 'done');
            if (!myTask) return null;

            const isCritical = incident.priority === 'critical';

            return (
              <div key={incident.id} className="card relative" style={{ borderLeft: isCritical ? '4px solid var(--color-critical)' : 'none' }}>
                <div className="flex justify-between items-start" style={{ marginBottom: '1rem' }}>
                  <div className="flex items-center gap-2">
                    <PriorityTag priority={incident.priority} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{incident.id}</span>
                  </div>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: 'var(--radius-sm)', 
                    backgroundColor: myTask.acknowledged ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                    color: myTask.acknowledged ? 'var(--color-success)' : 'var(--color-medium)',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {myTask.acknowledged ? 'IN PROGRESS' : 'PENDING ACKNOWLEDGEMENT'}
                  </span>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {incident.type.toUpperCase()} Emergency
                  </h2>
                  
                  <div className="flex items-center gap-4 mt-2" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex items-center gap-1"><MapPin size={16} /> {incident.location}</div>
                    <div className="flex items-center gap-1"><Clock size={16} /> {new Date(incident.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                  {!myTask.acknowledged ? (
                    <button 
                      className={`btn w-full ${isCritical ? 'btn-critical animate-pulse-critical' : 'btn-primary'}`} 
                      onClick={() => acknowledgeTask(incident.id, myTask.id)}
                    >
                      <AlertTriangle size={18} /> Acknowledge Receipt
                    </button>
                  ) : (
                    <button 
                      className="btn btn-success w-full" 
                      onClick={() => completeTask(incident.id, myTask.id, currentStaffId)}
                    >
                      <CheckCircle size={18} /> Mark as Resolved
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
