import React, { useState, useEffect } from 'react';
import { useRealtimeIncidents, useStaffStatus } from '../services/database';
import PriorityTag from '../components/shared/PriorityTag';
import { 
  AlertCircle, Users, CheckCircle, Sparkles, FileText, Loader, 
  Brain, Hash, Activity, Zap, Shield, Globe, Map as MapIcon, 
  Clock, ChevronRight, MessageSquare, Info, LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { ref, update } from 'firebase/database';

const AdminDashboard = () => {
  const { incidents, loading, escalateIncident, getAIRecommendations, forceResolveIncident, manualAssignStaff, manualReassignStaff } = useRealtimeIncidents();
  const { staff } = useStaffStatus();
  const [selectedStaffForTask, setSelectedStaffForTask] = useState({});
  const { signOut, currentUser } = useAuth();
  
  const [selectedId, setSelectedId] = useState(null);
  const [loadingAI, setLoadingAI] = useState({});
  const [showBrief, setShowBrief] = useState({});
  const [loadingEscalate, setLoadingEscalate] = useState({});
  const [loadingResolve, setLoadingResolve] = useState({});

  // Active vs Resolved
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  // Selected Incident
  const selectedIncident = incidents.find(i => i.id === selectedId) || activeIncidents[0];

  useEffect(() => {
    if (!selectedId && activeIncidents.length > 0) {
      setSelectedId(activeIncidents[0].id);
    }
  }, [activeIncidents, selectedId]);

  const handleGetRecommendations = async (incidentId) => {
    setLoadingAI(prev => ({ ...prev, [incidentId]: true }));
    await getAIRecommendations(incidentId);
    setLoadingAI(prev => ({ ...prev, [incidentId]: false }));
  };

  const handleEscalate = async (incidentId) => {
    setLoadingEscalate(prev => ({ ...prev, [incidentId]: true }));
    await escalateIncident(incidentId);
    setLoadingEscalate(prev => ({ ...prev, [incidentId]: false }));
  };

  const handleResolve = async (incidentId) => {
    setLoadingResolve(prev => ({ ...prev, [incidentId]: true }));
    try {
      await forceResolveIncident(incidentId);
    } catch (e) {
      console.error('Failed to resolve:', e);
    }
    setLoadingResolve(prev => ({ ...prev, [incidentId]: false }));
  };
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '1.5rem' }}>
        <div className="loader-ring"></div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Synchronizing Command Center</h2>
          <p style={{ color: 'var(--text-muted)' }}>Establishing secure link with CrisisSync regional servers...</p>
        </div>
        <style>{`
          .loader-ring {
            width: 48px; height: 48px;
            border: 3px solid rgba(59, 130, 246, 0.1);
            border-top-color: var(--color-info);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* HEADER SECTION (Inside Dashboard for focus) */}
      <div className="card" style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center gap-4">
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
            <Shield size={20} color="var(--color-info)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Global Command Control</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Admin: {currentUser?.name} | Region: North Sector</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 mr-4">
            <div className="health-dot active"><Zap size={12} /> Live</div>
            <div className="health-dot active"><Brain size={12} /> AI Ready</div>
          </div>
          <button className="nav-btn-outline" onClick={signOut} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <LogOut size={14} /> System Exit
          </button>
        </div>
      </div>

      {/* MASTER-DETAIL GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2.5fr', gap: '1.5rem', minHeight: '500px' }}>
        
        {/* LEFT COLUMN: ACTIVE INCIDENTS LIST */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Alerts ({activeIncidents.length})</span>
            <Activity size={16} color="var(--color-critical)" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {activeIncidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                All sectors nominal.
              </div>
            ) : (
              activeIncidents.map(incident => {
                const hasUnassigned = !incident.tasks || incident.tasks.length === 0 || incident.tasks.some(t => t.status === 'pending_assignment');
                return (
                <div 
                  key={incident.id}
                  onClick={() => setSelectedId(incident.id)}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: selectedId === incident.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedId === incident.id ? 'rgba(59, 130, 246, 0.2)' : (hasUnassigned ? 'var(--color-critical)' : 'transparent'),
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="incident-list-item"
                >
                  {selectedId === incident.id && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--color-info)' }} />}
                  <div className="flex justify-between items-start" style={{ marginBottom: '0.4rem' }}>
                    <PriorityTag priority={incident.priority} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{incident.type.toUpperCase()}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                    <Globe size={12} /> {incident.location}
                  </div>
                  {incident.tasks && incident.tasks.some(t => t.status === 'pending_assignment') ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-critical)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                       <AlertCircle size={12} /> PENDING ASSIGNMENT
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-info)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                       <Activity size={12} /> ACTIVE
                    </div>
                  )}
                </div>
              )})
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INCIDENT DETAIL PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {selectedIncident ? (
            <>
              {/* PRIMARY INFO CARD */}
              <div className="card" style={{ flexShrink: 0 }}>
                <div className="flex justify-between items-start" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <div className="flex items-center gap-3" style={{ marginBottom: '0.25rem' }}>
                      <h2 style={{ margin: 0 }}>{selectedIncident.type.toUpperCase()}</h2>
                      <PriorityTag priority={selectedIncident.priority} />
                    </div>
                    <div className="flex items-center gap-4" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1"><Globe size={14} /> {selectedIncident.location}</span>
                      <span className="flex items-center gap-1"><Clock size={14} /> Reported {new Date(selectedIncident.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="btn" 
                      style={{ background: 'var(--color-critical)', borderColor: 'var(--color-critical)', color: '#fff' }}
                      disabled={loadingEscalate[selectedIncident.id]}
                      onClick={() => handleEscalate(selectedIncident.id)}
                    >
                      {loadingEscalate[selectedIncident.id] ? <Loader size={16} className="animate-spin" /> : <AlertCircle size={16} />} 
                      Escalate
                    </button>
                    <button 
                      className="btn-primary" 
                      style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                      disabled={loadingResolve[selectedIncident.id]}
                      onClick={() => handleResolve(selectedIncident.id)}
                    >
                      {loadingResolve[selectedIncident.id] ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />} 
                      Mark Resolved
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* AI Summary Section */}
                  <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem', color: 'var(--color-info)' }}>
                      <Brain size={18} />
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Intelligence Brief</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, fontWeight: 500 }}>{selectedIncident.aiSummary}</p>
                    {selectedIncident.keywords && (
                      <div className="flex gap-2" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
                        {selectedIncident.keywords.map((kw, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)', borderRadius: 'var(--radius-full)' }}>
                            <Hash size={10} style={{ display: 'inline', marginRight: '2px' }} />{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Severity section */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                      <AlertCircle size={18} color="var(--color-critical)" />
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity Analysis</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', height: '40px', alignItems: 'flex-end', marginBottom: '1rem' }}>
                      {[...Array(10)].map((_, i) => (
                        <div key={i} style={{ 
                          flex: 1, 
                          height: `${(i + 1) * 10}%`, 
                          background: i < selectedIncident.severity 
                            ? (selectedIncident.severity > 7 ? 'var(--color-critical)' : 'var(--color-info)') 
                            : 'rgba(255,255,255,0.1)',
                          borderRadius: '2px'
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Level {selectedIncident.severity}/10</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {selectedIncident.severity > 7 ? 'Evacuation protocol recommended' : 'Localized response sufficient'}
                    </div>
                  </div>
                </div>
              </div>

              {/* TASKS & STAFF STATUS */}
              <div className="card">
                <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Active Resource Deployment</h3>
                  <button 
                    className="btn" 
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)' }}
                    onClick={() => handleGetRecommendations(selectedIncident.id)}
                    disabled={loadingAI[selectedIncident.id]}
                  >
                    <Sparkles size={14} /> AI Optimization
                  </button>
                </div>
                
                <div className="grid gap-3">
                  {selectedIncident.tasks && selectedIncident.tasks.length > 0 ? (
                    selectedIncident.tasks.map(task => {
                      const availableStaffForRole = staff.filter(s => s.isAvailable === true && s.role === task.role);

                      if (task.status === 'pending_assignment') {
                        return (
                          <div key={task.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <div className="flex items-center gap-4">
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-critical)' }}>
                                <AlertCircle size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--color-critical)' }}>Requires {task.role.toUpperCase()}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: UNASSIGNED - NO STAFF AVAILABLE</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <select 
                                 value={selectedStaffForTask[task.id] || ''} 
                                 onChange={(e) => setSelectedStaffForTask({...selectedStaffForTask, [task.id]: e.target.value})}
                                 style={{ padding: '0.4rem', border: '1px solid var(--border-light)', borderRadius: '4px', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                               >
                                 <option value="">Select Staff</option>
                                 {availableStaffForRole.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                               </select>
                               <button 
                                 className="btn-primary" 
                                 disabled={!selectedStaffForTask[task.id]}
                                 onClick={() => {
                                   manualAssignStaff(selectedIncident.id, task.id, selectedStaffForTask[task.id], task.role);
                                   setSelectedStaffForTask({...selectedStaffForTask, [task.id]: ''});
                                 }}
                                 style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                               >Assign</button>
                            </div>
                          </div>
                        );
                      }
                      
                      const assignedUser = staff.find(s => s.id === task.staff_id);
                      return (
                        <div key={task.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <div className="flex items-center gap-4">
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                              <Users size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{assignedUser?.name || task.staff_name || 'Unit ' + task.staff_id}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {task.status.toUpperCase()}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                               <select 
                                 value={selectedStaffForTask[task.id] || ''} 
                                 onChange={(e) => setSelectedStaffForTask({...selectedStaffForTask, [task.id]: e.target.value})}
                                 style={{ padding: '0.4rem', border: '1px solid var(--border-light)', borderRadius: '4px', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                               >
                                 <option value="">Reassign to...</option>
                                 {availableStaffForRole.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                               </select>
                               <button 
                                 className="btn nav-btn-outline" 
                                 disabled={!selectedStaffForTask[task.id]}
                                 onClick={() => {
                                   manualReassignStaff(selectedIncident.id, task.id, selectedStaffForTask[task.id], task.staff_id);
                                   setSelectedStaffForTask({...selectedStaffForTask, [task.id]: ''});
                                 }}
                                 style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                               >Submit</button>
                            </div>
                            <div className="flex items-center gap-2">
                               <span style={{ fontSize: '0.75rem', color: task.acknowledged ? 'var(--color-success)' : 'orange', fontWeight: 600 }}>
                                 {task.acknowledged ? '✓ ACK' : '○ PENDING_ACK'}
                               </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-critical)', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>⚠ No staff assigned</div>
                      <div className="flex items-center gap-2">
                        {(() => {
                           const requiredRole = selectedIncident.type || 'medical';
                           const availableStaffForRole = staff.filter(s => s.isAvailable === true && s.role === requiredRole);
                           return (
                             <>
                               <select 
                                 value={selectedStaffForTask['new'] || ''} 
                                 onChange={(e) => setSelectedStaffForTask({...selectedStaffForTask, 'new': e.target.value})}
                                 style={{ padding: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '4px', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                               >
                                 <option value="">Select available {requiredRole.toUpperCase()} staff...</option>
                                 {availableStaffForRole.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                               </select>
                               <button 
                                 className="btn" 
                                 disabled={!selectedStaffForTask['new']}
                                 onClick={() => {
                                   manualAssignStaff(selectedIncident.id, `TASK-${Date.now()}`, selectedStaffForTask['new'], requiredRole);
                                   setSelectedStaffForTask({...selectedStaffForTask, 'new': ''});
                                 }}
                                 style={{ background: 'var(--color-critical)', color: '#fff', borderColor: 'var(--color-critical)', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                               >Assign Staff</button>
                             </>
                           )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ 
                width: 80, height: 80, borderRadius: '50%', 
                background: 'rgba(59, 130, 246, 0.05)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                border: '1px solid rgba(59, 130, 246, 0.1)'
              }}>
                <Globe size={40} color="var(--color-info)" className="animate-pulse" />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>System Status: Nominal</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                All sectors are reporting no active emergencies. Monitoring global crisis signals for real-time alerts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: LOGS & TIMELINE & MAP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', minHeight: '300px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>GLOBAL INCIDENT TIMELINE</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LIVE UPDATES</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="timeline-item">
                <span className="timestamp">20:31</span>
                <span className="event">AI Classification updated for medical alert in Sector 4</span>
              </div>
              <div className="timeline-item">
                <span className="timestamp">20:25</span>
                <span className="event">Staff John assigned to Security Breached incident</span>
              </div>
              <div className="timeline-item">
                <span className="timestamp">20:18</span>
                <span className="event text-critical">SYSTEM ALERT: Severe storm warning issued for venue</span>
              </div>
              <div className="timeline-item">
                <span className="timestamp">20:02</span>
                <span className="event">Medical station 2 replenished supplies</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2, background: 'rgba(0,0,0,0.6)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>
            TACTICAL MAP VIEW
          </div>
          <div className="map-placeholder" style={{ width: '100%', height: '100%', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Mock Map View */}
            <div style={{ position: 'relative', width: '200px', height: '150px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}>
               <div className="radar-ping" style={{ top: '20%', left: '30%' }}></div>
               <div className="radar-ping critical" style={{ top: '60%', left: '70%' }}></div>
               <div className="radar-ping info" style={{ top: '40%', left: '50%' }}></div>
               <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}><MapIcon size={24} color="var(--color-info)" /></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .incident-list-item:hover {
          background: rgba(59, 130, 246, 0.05) !important;
        }
        .health-dot {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 800;
          color: rgba(255,255,255,0.4);
        }
        .health-dot.active {
          color: #10b981;
        }
        .timeline-item {
          display: flex;
          gap: 1rem;
          font-size: 0.85rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        .timeline-item .timestamp {
          color: var(--color-info);
          font-weight: 700;
          width: 40px;
        }
        .timeline-item .event {
          color: var(--text-secondary);
        }
        .text-critical {
          color: var(--color-critical) !important;
        }
        .radar-ping {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }
        .radar-ping.critical { background: var(--color-critical); box-shadow: 0 0 10px var(--color-critical); }
        .radar-ping.info { background: var(--color-info); box-shadow: 0 0 10px var(--color-info); }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
