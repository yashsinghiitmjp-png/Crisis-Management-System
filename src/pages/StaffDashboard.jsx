import React, { useState } from 'react';
import { useRealtimeTasks } from '../services/database';
import PriorityTag from '../components/shared/PriorityTag';
import { MapPin, Clock, CheckCircle, AlertTriangle, ArrowRightCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StaffDashboard = () => {
  const { currentUser } = useAuth();
  const initialStaffId = currentUser?.staffId || 's1';
  const [currentStaffId, setCurrentStaffId] = useState(initialStaffId);
  
  const { activeTasks, acknowledgeTask, completeTask } = useRealtimeTasks(currentStaffId);

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>My Active Tasks</h1>
          <p>Signed in as staff ID: {currentStaffId}</p>
        </div>
        
        {/* Keep selector for prototype testing between staff personas */}
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
                  
                  <div className="flex items-center gap-4 mt-2" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <div className="flex items-center gap-1"><MapPin size={16} /> {incident.location}</div>
                    <div className="flex items-center gap-1"><Clock size={16} /> {new Date(incident.timestamp).toLocaleTimeString()}</div>
                  </div>

                  {incident.aiSummary && (
                    <p style={{ margin: '0.5rem 0', fontWeight: 500, fontSize: '1.1rem' }}>{incident.aiSummary}</p>
                  )}

                  {incident.aiRecommendedActions && incident.aiRecommendedActions.length > 0 && (
                    <div style={{ marginTop: '1rem', background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-info)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recommended Response Actions</span>
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {incident.aiRecommendedActions.map((action, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            <ArrowRightCircle size={14} style={{ marginTop: '3px', color: 'var(--color-info)', flexShrink: 0 }} />
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
