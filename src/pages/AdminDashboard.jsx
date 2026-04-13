import React from 'react';
import { useRealtimeIncidents, useStaffStatus } from '../services/mockDatabase';
import PriorityTag from '../components/shared/PriorityTag';
import { AlertCircle, Users, CheckCircle } from 'lucide-react';

const AdminDashboard = () => {
  const { incidents, escalateIncident } = useRealtimeIncidents();
  const { staff } = useStaffStatus();

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Global Command Center</h1>
          <p>Real-time oversight of all incidents and staff distribution.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '2rem' }}>
        <div className="card flex items-center gap-4">
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-full)' }}>
            <AlertCircle color="var(--color-critical)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{activeIncidents.length}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Active Incidents</div>
          </div>
        </div>
        
        <div className="card flex items-center gap-4">
          <div style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-full)' }}>
            <Users color="var(--color-info)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {staff.filter(s => s.isAvailable).length} / {staff.length}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>Available Staff</div>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div style={{ padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-full)' }}>
            <CheckCircle color="var(--color-success)" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{resolvedIncidents.length}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Resolved Today</div>
          </div>
        </div>
      </div>

      <h2>Live Incident Feed</h2>
      <div className="grid gap-4">
        {incidents.length === 0 ? (
          <div className="card text-center" style={{ padding: '3rem', color: 'var(--text-muted)' }}>
            System nominal. No incidents logged.
          </div>
        ) : (
          incidents.map(incident => (
            <div key={incident.id} className="card flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3" style={{ marginBottom: '0.5rem' }}>
                  <PriorityTag priority={incident.priority} />
                  <span style={{ fontWeight: 'bold' }}>{incident.type.toUpperCase()} - {incident.location}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                </div>
                
                <div className="flex gap-2">
                  {incident.tasks.length === 0 ? (
                    <span style={{ color: 'var(--color-medium)', fontSize: '0.875rem' }}>⚠️ Pending Staff Assignment (No available staff)</span>
                  ) : (
                    incident.tasks.map(task => {
                      const assignedUser = staff.find(s => s.id === task.staff_id);
                      return (
                        <span key={task.id} style={{ 
                          fontSize: '0.875rem', 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'var(--bg-main)', 
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                          color: task.acknowledged ? 'var(--color-success)' : 'var(--color-medium)'
                        }}>
                          {assignedUser?.name} ({task.status})
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {incident.priority !== 'critical' && incident.status !== 'resolved' && (
                  <button className="btn" style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--color-critical)', color: 'var(--color-critical)' }} onClick={() => escalateIncident(incident.id)}>
                    Escalate Priority
                  </button>
                )}
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: incident.status === 'resolved' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  color: incident.status === 'resolved' ? 'var(--color-success)' : 'var(--color-info)'
                }}>
                  {incident.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2>Staff Roster Status</h2>
        <div className="card">
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '1rem' }}>Name</th>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem' }}>{member.name}</td>
                  <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{member.role}</td>
                  <td style={{ padding: '1rem' }}>
                    {member.isAvailable ? (
                      <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></div>
                        Available
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-medium)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-medium)' }}></div>
                        On Assignment
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
