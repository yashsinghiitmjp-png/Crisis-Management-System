import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeIncidents, useStaffStatus, useRealtimeLogs } from '../services/database';
import PriorityTag from '../components/shared/PriorityTag';
import {
  AlertCircle, Users, CheckCircle, Sparkles, Loader,
  Brain, Hash, Activity, Zap, Shield, Globe,
  Clock, MessageSquare, LogOut, ChevronDown, ChevronUp,
  TrendingUp, ArrowRightCircle, Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const PRIORITY_COLORS = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-info)',
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

const resolveSeverity = (incident) => {
  const numeric = Number(incident?.severity);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.min(10, Math.round(numeric)));
  }

  if (incident?.aiRecommendations?.escalation_needed) {
    return Math.max(8, fallbackSeverityFromPriority(incident?.priority));
  }

  return fallbackSeverityFromPriority(incident?.priority);
};

const resolveEscalationMode = (incident) => {
  if (incident?.escalationMode) return incident.escalationMode;
  return resolveSeverity(incident) >= 8 || incident?.priority === 'critical'
    ? 'ai_auto'
    : 'admin_review';
};

const statusLabel = (s) => {
  const map = {
    active: 'ACTIVE',
    in_progress: 'IN PROGRESS',
    resolved: 'RESOLVED',
    pending: 'PENDING',
    pending_assignment: 'UNASSIGNED',
    acknowledged: 'ACKNOWLEDGED',
    done: 'DONE',
  };
  return map[s] || (s || '').toUpperCase();
};

// ---------------------------------------------------------------------------
// Sub-component: Timeline Feed
// ---------------------------------------------------------------------------
const TimelineFeed = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No timeline events yet.
      </div>
    );
  }

  // Show newest first
  const sorted = [...events].reverse();

  return (
    <div className="timeline-feed">
      {sorted.map((ev, i) => (
        <div key={i} className="timeline-item">
          <span className="timestamp">
            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="event">{ev.event}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: AI Recommendations Panel
// ---------------------------------------------------------------------------
const AIRecommendationsPanel = ({ recommendations }) => {
  if (!recommendations) return null;

  let items = [];
  const source = recommendations.recommendations ? recommendations.recommendations : recommendations;

  if (Array.isArray(source)) {
    items = source;
  } else if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      items = [source];
    }
  } else {
    items = Object.values(source);
  }

  if (items.length === 0) return null;

  // Optionals
  const escNeeded = recommendations.escalation_needed;
  const estTime = recommendations.estimated_resolution_time;
  const refreshedAt = recommendations.refreshedAt;
  const refreshCount = recommendations.refreshCount;

  const getUrgencyColor = (urgency) => {
    switch (urgency?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'var(--color-critical, #ef4444)';
      case 'medium':
        return 'var(--color-medium, #f59e0b)';
      case 'low':
        return 'var(--color-info, #3b82f6)';
      default:
        return 'var(--color-info, #3b82f6)';
    }
  };

  return (
    <div
      style={{
        background: 'rgba(59,130,246,0.05)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        marginTop: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          color: 'var(--color-info)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} />
          <span style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Recommendations {recommendations?.verification_code && `[CODE: ${recommendations.verification_code}]`}
          </span>
        </div>
        {estTime && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ETA: {estTime}
            </div>
            {refreshedAt && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Refreshed {new Date(refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {refreshCount ? ` (${refreshCount}x)` : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {escNeeded && (
        <div style={{
          marginBottom: '0.8rem',
          padding: '0.5rem',
          background: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-critical)',
          fontSize: '0.75rem',
          fontWeight: 700,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
           Escalation strongly recommended by AI
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {items.map((item, i) => {
          const isObject = typeof item === 'object' && item !== null;
          const actionText = isObject ? item.action || JSON.stringify(item) : item;
          const urgency = isObject ? item.urgency : null;
          const urgencyColor = getUrgencyColor(urgency);

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                fontSize: '0.88rem',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${urgencyColor}`,
              }}
            >
              <ArrowRightCircle size={14} style={{ marginTop: '2px', color: urgencyColor, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-main, #fff)', fontWeight: 500 }}>
                  {actionText}
                </span>
                {urgency && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: urgencyColor,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {urgency} PRIORITY
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: Incident List Item
// ---------------------------------------------------------------------------
const IncidentListItem = ({ incident, isSelected, onClick }) => {
  const hasUnassigned =
    !incident.tasks ||
    incident.tasks.length === 0 ||
    incident.tasks.some((t) => t.status === 'pending_assignment');

  const priorityColor = PRIORITY_COLORS[incident.priority] || 'transparent';

  return (
    <div
      onClick={onClick}
      className="incident-list-item"
      style={{
        padding: '1rem',
        marginBottom: '0.5rem',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
        border: '1px solid',
        borderColor: isSelected
          ? 'rgba(59,130,246,0.2)'
          : hasUnassigned
          ? 'var(--color-critical)'
          : 'transparent',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            background: 'var(--color-info)',
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.4rem',
        }}
      >
        <PriorityTag priority={incident.priority} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
        {incident.type?.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          marginBottom: '0.4rem',
        }}
      >
        <Globe size={12} /> {incident.location}
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: incident.tasks?.some((t) => t.status === 'pending_assignment')
            ? 'var(--color-critical)'
            : 'var(--color-info)',
        }}
      >
        {incident.tasks?.some((t) => t.status === 'pending_assignment') ? (
          <><AlertCircle size={12} /> PENDING ASSIGNMENT</>
        ) : (
          <><Activity size={12} /> {statusLabel(incident.status)}</>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main AdminDashboard
// ---------------------------------------------------------------------------
const AdminDashboard = () => {
  const {
    incidents,
    loading,
    escalateIncident,
    updateEscalationMode,
    updatePriority,
    getAIRecommendations,
    forceResolveIncident,
    manualAssignStaff,
    manualReassignStaff,
  } = useRealtimeIncidents();
  const { staff } = useStaffStatus();
  const logs = useRealtimeLogs();
  const { signOut, currentUser } = useAuth();

  const [selectedId, setSelectedId] = useState(null);
  const [loadingAI, setLoadingAI] = useState({});
  const [loadingEscalate, setLoadingEscalate] = useState({});
  const [loadingEscalationMode, setLoadingEscalationMode] = useState({});
  const [loadingResolve, setLoadingResolve] = useState({});
  const [selectedStaffForTask, setSelectedStaffForTask] = useState({});
  const [newPriority, setNewPriority] = useState({});
  const [showResolved, setShowResolved] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const int = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(int);
  }, []);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');
  const selectedIncident = incidents.find((i) => i.id === selectedId) || activeIncidents[0];

  // Auto-select first active incident
  useEffect(() => {
    if (!selectedId && activeIncidents.length > 0) {
      setSelectedId(activeIncidents[0].id);
    }
  }, [activeIncidents, selectedId]);

  // Sync priority selector to selected incident
  useEffect(() => {
    if (selectedIncident?.id) {
      setNewPriority((prev) => ({
        ...prev,
        [selectedIncident.id]: selectedIncident.priority,
      }));
    }
  }, [selectedIncident?.id, selectedIncident?.priority]);

  // TIME CALCULATION
  const calculateDuration = (startMs, endMs, isFinal) => {
    if (!startMs) return '—';
    if (!endMs && isFinal) return '—';
    const effectiveEnd = endMs || nowMs;
    const diff = effectiveEnd - startMs;
    if (diff < 0) return '—';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  const createdTime = selectedIncident?.timestamp ? new Date(selectedIncident.timestamp).getTime() : 0;
  const assignedTime = selectedIncident?.assignedAt ? new Date(selectedIncident.assignedAt).getTime() : 0;
  const startedTime = selectedIncident?.startedAt ? new Date(selectedIncident.startedAt).getTime() : 0;
  const resolvedTime = selectedIncident?.resolvedAt ? new Date(selectedIncident.resolvedAt).getTime() : 0;
  const selectedPriorityValue =
    selectedIncident ? (newPriority[selectedIncident.id] || selectedIncident.priority) : 'low';
  const hasPendingPriorityChange =
    !!selectedIncident && selectedPriorityValue !== selectedIncident.priority;
  const selectedSeverity = selectedIncident ? resolveSeverity(selectedIncident) : null;
  const selectedEscalationMode = selectedIncident ? resolveEscalationMode(selectedIncident) : 'admin_review';
  const aiSuggestsEscalation = selectedIncident?.aiRecommendations?.escalation_needed === true;
  const isEscalated = selectedIncident?.priority === 'critical';

  const responseTimeStr = calculateDuration(createdTime, assignedTime, false);
  const actionTimeStr = calculateDuration(assignedTime, startedTime, false);
  const resolutionTimeStr = calculateDuration(createdTime, resolvedTime, !!resolvedTime);

  const handleGetRecommendations = useCallback(async (incidentId) => {
    setLoadingAI((p) => ({ ...p, [incidentId]: true }));
    await getAIRecommendations(incidentId);
    setLoadingAI((p) => ({ ...p, [incidentId]: false }));
  }, [getAIRecommendations]);

  const handleEscalate = useCallback(async (incidentId) => {
    setLoadingEscalate((p) => ({ ...p, [incidentId]: true }));
    await escalateIncident(incidentId);
    setLoadingEscalate((p) => ({ ...p, [incidentId]: false }));
  }, [escalateIncident]);

  const handleEscalationModeChange = useCallback(async (incidentId, escalationMode) => {
    setLoadingEscalationMode((p) => ({ ...p, [incidentId]: true }));
    await updateEscalationMode(incidentId, escalationMode);
    setLoadingEscalationMode((p) => ({ ...p, [incidentId]: false }));
  }, [updateEscalationMode]);

  const handleResolve = useCallback(async (incidentId) => {
    setLoadingResolve((p) => ({ ...p, [incidentId]: true }));
    try {
      await forceResolveIncident(incidentId);
      setSelectedId(null);
    } catch (e) {
      console.error('Failed to resolve:', e);
    }
    setLoadingResolve((p) => ({ ...p, [incidentId]: false }));
  }, [forceResolveIncident]);

  const handlePriorityChange = useCallback(async (incidentId) => {
    const p = newPriority[incidentId];
    if (p && p !== selectedIncident?.priority) {
      await updatePriority(incidentId, p);
    }
  }, [newPriority, selectedIncident, updatePriority]);

  // Loading state
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: '60vh', gap: '1.5rem' }}
      >
        <div className="loader-ring" />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Synchronizing Command Center</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Establishing secure link with CrisisSync servers…
          </p>
        </div>
        <style>{`
          .loader-ring {
            width: 48px; height: 48px;
            border: 3px solid rgba(59,130,246,0.1);
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
    <div
      className="animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}
    >
      {/* ── HEADER BAR ── */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            style={{
              background: 'rgba(59,130,246,0.1)',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Shield size={20} color="var(--color-info)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Global Command Control</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Admin: {currentUser?.name || currentUser?.email} | Region: North Sector
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 mr-4">
            <div className="health-dot active"><Zap size={12} /> Live</div>
            <div className="health-dot active"><Brain size={12} /> AI Ready</div>
          </div>
          <button
            className="nav-btn-outline"
            onClick={signOut}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <LogOut size={14} /> System Exit
          </button>
        </div>
      </div>

      {/* ── MASTER-DETAIL GRID ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1fr) 2.5fr',
          gap: '1.5rem',
          minHeight: '500px',
        }}
      >
        {/* LEFT: Incident List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Active Alerts ({activeIncidents.length})
            </span>
            <Activity size={16} color="var(--color-critical)" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {activeIncidents.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                All sectors nominal.
              </div>
            ) : (
              activeIncidents.map((incident) => (
                <IncidentListItem
                  key={incident.id}
                  incident={incident}
                  isSelected={selectedId === incident.id}
                  onClick={() => setSelectedId(incident.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {selectedIncident ? (
            <>
              {/* PRIMARY INFO CARD */}
              <div className="card" style={{ flexShrink: 0 }}>
                <div
                  className="flex justify-between items-start"
                  style={{ marginBottom: '1.5rem' }}
                >
                  <div>
                    <div
                      className="flex items-center gap-3"
                      style={{ marginBottom: '0.25rem' }}
                    >
                      <h2 style={{ margin: 0 }}>{selectedIncident.type?.toUpperCase()}</h2>
                      <PriorityTag priority={selectedIncident.priority} />
                    </div>
                    <div
                      className="flex items-center gap-4"
                      style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}
                    >
                      <span className="flex items-center gap-1">
                        <Globe size={14} /> {selectedIncident.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> Reported{' '}
                        {new Date(selectedIncident.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
                    {/* Priority Change */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <select
                        id={`priority-select-${selectedIncident.id}`}
                        value={selectedPriorityValue}
                        onChange={(e) =>
                          setNewPriority((p) => ({ ...p, [selectedIncident.id]: e.target.value }))
                        }
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-main)',
                          color: PRIORITY_COLORS[selectedPriorityValue],
                          border: `1px solid ${PRIORITY_COLORS[selectedPriorityValue]}`,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        id={`apply-priority-btn-${selectedIncident.id}`}
                        className="btn"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: 'var(--radius-sm)',
                          background: hasPendingPriorityChange ? 'rgba(59,130,246,0.12)' : 'transparent',
                          borderColor: hasPendingPriorityChange ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                          color: hasPendingPriorityChange ? 'var(--color-info)' : 'var(--text-muted)',
                          cursor: hasPendingPriorityChange ? 'pointer' : 'not-allowed',
                          opacity: hasPendingPriorityChange ? 1 : 0.65,
                        }}
                        disabled={!hasPendingPriorityChange}
                        onClick={() => handlePriorityChange(selectedIncident.id)}
                      >
                        <TrendingUp size={13} /> Apply
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        id={`escalate-btn-${selectedIncident.id}`}
                        className="btn"
                        style={{
                          background: isEscalated ? 'rgba(255,255,255,0.04)' : 'rgba(239, 68, 68, 0.1)',
                          borderColor: isEscalated ? 'rgba(255,255,255,0.08)' : 'rgba(239, 68, 68, 0.25)',
                          color: isEscalated ? 'var(--text-muted)' : 'var(--color-critical)',
                          padding: '0.5rem 1rem',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 600,
                          cursor: isEscalated ? 'not-allowed' : 'pointer',
                          opacity: isEscalated ? 0.75 : 1,
                        }}
                        disabled={loadingEscalate[selectedIncident.id] || isEscalated}
                        onClick={() => handleEscalate(selectedIncident.id)}
                      >
                        {loadingEscalate[selectedIncident.id] ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <AlertCircle size={16} />
                        )}
                        {isEscalated ? 'Escalated' : 'Escalate'}
                      </button>
                      <button
                        id={`resolve-btn-${selectedIncident.id}`}
                        className="btn-primary"
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderColor: 'rgba(34, 197, 94, 0.25)',
                          color: 'var(--color-success)',
                          padding: '0.5rem 1rem',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 600,
                        }}
                        disabled={loadingResolve[selectedIncident.id]}
                        onClick={() => handleResolve(selectedIncident.id)}
                      >
                        {loadingResolve[selectedIncident.id] ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Mark Resolved
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.9rem 1rem',
                      marginTop: '1rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.2rem',
                        }}
                      >
                        Escalation Control
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {selectedEscalationMode === 'ai_auto'
                          ? 'AI backup auto-escalates very high-severity incidents when recommendations or severity indicate critical risk.'
                          : 'Admin reviews lower-risk incidents manually before escalating them to critical.'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        disabled={loadingEscalationMode[selectedIncident.id] || selectedEscalationMode === 'admin_review'}
                        onClick={() => handleEscalationModeChange(selectedIncident.id, 'admin_review')}
                        style={{
                          background: selectedEscalationMode === 'admin_review' ? 'rgba(59,130,246,0.12)' : 'transparent',
                          borderColor: selectedEscalationMode === 'admin_review' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                          color: selectedEscalationMode === 'admin_review' ? 'var(--color-info)' : 'var(--text-secondary)',
                          opacity: loadingEscalationMode[selectedIncident.id] ? 0.7 : 1,
                        }}
                      >
                        Admin Review
                      </button>
                      <button
                        className="btn"
                        disabled={loadingEscalationMode[selectedIncident.id] || selectedEscalationMode === 'ai_auto'}
                        onClick={() => handleEscalationModeChange(selectedIncident.id, 'ai_auto')}
                        style={{
                          background: selectedEscalationMode === 'ai_auto' ? 'rgba(239,68,68,0.12)' : 'transparent',
                          borderColor: selectedEscalationMode === 'ai_auto' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)',
                          color: selectedEscalationMode === 'ai_auto' ? 'var(--color-critical)' : 'var(--text-secondary)',
                          opacity: loadingEscalationMode[selectedIncident.id] ? 0.7 : 1,
                        }}
                      >
                        AI Auto
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* AI Summary */}
                  <div
                    style={{
                      background: 'rgba(59,130,246,0.05)',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(59,130,246,0.1)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2"
                      style={{ marginBottom: '0.75rem', color: 'var(--color-info)' }}
                    >
                      <Brain size={18} />
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        AI Intelligence Brief
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
                      {selectedIncident.aiSummary}
                    </p>
                    {selectedIncident.keywords && selectedIncident.keywords.length > 0 && (
                      <div
                        className="flex gap-2"
                        style={{ marginTop: '1rem', flexWrap: 'wrap' }}
                      >
                        {selectedIncident.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.6rem',
                              background: 'rgba(59,130,246,0.1)',
                              color: 'var(--color-info)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            <Hash size={10} style={{ display: 'inline', marginRight: '2px' }} />
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AI Recommendations (rendered if fetched) */}
                    <AIRecommendationsPanel recommendations={selectedIncident.aiRecommendations} />

                    {/* AI Recommendations button */}
                    <button
                      id={`ai-rec-btn-${selectedIncident.id}`}
                      className="btn"
                      style={{
                        marginTop: '1rem',
                        width: '100%',
                        fontSize: '0.8rem',
                        padding: '0.45rem 0.8rem',
                        background: 'rgba(59,130,246,0.1)',
                        color: 'var(--color-info)',
                        justifyContent: 'center',
                      }}
                      onClick={() => handleGetRecommendations(selectedIncident.id)}
                      disabled={loadingAI[selectedIncident.id]}
                    >
                      {loadingAI[selectedIncident.id] ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}{' '}
                      {selectedIncident.aiRecommendations ? 'Refresh AI Recommendations' : 'Get AI Recommendations'}
                    </button>
                  </div>

                  {/* Severity */}
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2"
                      style={{ marginBottom: '1rem' }}
                    >
                      <AlertCircle size={18} color="var(--color-critical)" />
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Severity Analysis
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        height: '40px',
                        alignItems: 'flex-end',
                        marginBottom: '1rem',
                      }}
                    >
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: `${(i + 1) * 10}%`,
                            background:
                              i < (selectedSeverity || 0)
                                ? selectedSeverity > 7
                                  ? 'var(--color-critical)'
                                  : 'var(--color-info)'
                                : 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      Level {selectedSeverity || '—'}/10
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {aiSuggestsEscalation
                        ? 'AI recommends escalation support for this incident'
                        : (selectedSeverity || 0) > 7
                          ? 'Evacuation protocol recommended'
                          : 'Localized response sufficient'}
                    </div>

                  </div>
                </div>

                {/* OPERATIONAL INTELLIGENCE & MAP */}
                <div className="grid grid-cols-2 gap-4" style={{ marginTop: '1rem' }}>
                  {/* Timers */}
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={16} color="var(--color-info)" />
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Operational Timers
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Response Time</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{responseTimeStr}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action Time</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{actionTimeStr}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resolution</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{resolutionTimeStr}</div>
                      </div>
                    </div>
                  </div>

                  {/* Map Placeholder */}
                  <div
                    style={{
                      background: 'rgba(59,130,246,0.05)',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(59,130,246,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', opacity: 0.1, width: '100%', height: '100%', background: 'radial-gradient(circle at center, var(--color-info) 0%, transparent 60%)' }} />
                    <Globe size={32} color="var(--color-info)" style={{ marginBottom: '0.5rem', zIndex: 1 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', zIndex: 1 }}>{selectedIncident.location}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-info)', zIndex: 1, marginTop: '0.2rem' }}>SECTOR MAP ONLINE</span>
                  </div>
                </div>
              </div>

              {/* TASKS & STAFF DEPLOYMENT */}
              <div className="card">
                <div
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    paddingBottom: '1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    <Users size={18} style={{ display: 'inline', marginRight: '0.4rem' }} />
                    Active Resource Deployment
                  </h3>
                </div>

                <div className="grid gap-3">
                  {selectedIncident.tasks && selectedIncident.tasks.length > 0 ? (
                    selectedIncident.tasks.map((task) => {
                      const availableStaffForRole = staff.filter(
                        (s) => s.isAvailable === true && s.role === task.role
                      );

                      if (task.status === 'pending_assignment') {
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '1rem',
                              justifyContent: 'space-between',
                              padding: '1rem',
                              background: 'rgba(239,68,68,0.05)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid rgba(239,68,68,0.3)',
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  background: 'rgba(239,68,68,0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid rgba(239,68,68,0.2)',
                                  color: 'var(--color-critical)',
                                }}
                              >
                                <AlertCircle size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--color-critical)' }}>
                                  Requires {task.role?.toUpperCase()}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  Status: UNASSIGNED — NO STAFF AVAILABLE
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedStaffForTask[task.id] || ''}
                                onChange={(e) =>
                                  setSelectedStaffForTask({ ...selectedStaffForTask, [task.id]: e.target.value })
                                }
                                style={{
                                  padding: '0.4rem',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '4px',
                                  background: 'var(--bg-main)',
                                  color: 'var(--text-main)',
                                }}
                              >
                                <option value="">Select Staff</option>
                                {availableStaffForRole.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <button
                                className="btn-primary"
                                disabled={!selectedStaffForTask[task.id]}
                                onClick={() => {
                                  manualAssignStaff(selectedIncident.id, task.id, selectedStaffForTask[task.id], task.role);
                                  setSelectedStaffForTask({ ...selectedStaffForTask, [task.id]: '' });
                                }}
                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                              >
                                Assign
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const assignedUser = staff.find((s) => s.id === task.staff_id);
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '1rem',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: 'var(--bg-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-light)',
                              }}
                            >
                              <Users size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                {assignedUser?.name || task.staff_name || `Unit ${task.staff_id}`}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Status:{' '}
                                <span
                                  style={{
                                    color:
                                      task.status === 'in_progress'
                                        ? 'var(--color-success)'
                                        : task.status === 'acknowledged'
                                        ? 'var(--color-info)'
                                        : 'var(--color-medium)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {statusLabel(task.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: task.acknowledged ? 'var(--color-success)' : 'orange',
                                fontWeight: 600,
                              }}
                            >
                              {task.acknowledged ? '✓ ACK' : '○ PENDING_ACK'}
                            </span>
                            <select
                              value={selectedStaffForTask[task.id] || ''}
                              onChange={(e) =>
                                setSelectedStaffForTask({ ...selectedStaffForTask, [task.id]: e.target.value })
                              }
                              style={{
                                padding: '0.4rem',
                                border: '1px solid var(--border-light)',
                                borderRadius: '4px',
                                background: 'var(--bg-main)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                              }}
                            >
                              <option value="">Reassign to…</option>
                              {availableStaffForRole.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <button
                              className="btn nav-btn-outline"
                              disabled={!selectedStaffForTask[task.id]}
                              onClick={() => {
                                manualReassignStaff(selectedIncident.id, task.id, selectedStaffForTask[task.id], task.staff_id);
                                setSelectedStaffForTask({ ...selectedStaffForTask, [task.id]: '' });
                              }}
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* No tasks — manual assign */
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '1.5rem',
                        color: 'var(--color-critical)',
                        border: '1px dashed rgba(239,68,68,0.3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>⚠ No staff assigned</div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const requiredRole = selectedIncident.type || 'medical';
                          const avail = staff.filter((s) => s.isAvailable && s.role === requiredRole);
                          return (
                            <>
                              <select
                                value={selectedStaffForTask['new'] || ''}
                                onChange={(e) =>
                                  setSelectedStaffForTask({ ...selectedStaffForTask, new: e.target.value })
                                }
                                style={{
                                  padding: '0.4rem',
                                  border: '1px solid rgba(239,68,68,0.5)',
                                  borderRadius: '4px',
                                  background: 'var(--bg-main)',
                                  color: 'var(--text-main)',
                                }}
                              >
                                <option value="">Select available {requiredRole.toUpperCase()} staff…</option>
                                {avail.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <button
                                className="btn"
                                disabled={!selectedStaffForTask['new']}
                                onClick={() => {
                                  manualAssignStaff(selectedIncident.id, `TASK-${Date.now()}`, selectedStaffForTask['new'], requiredRole);
                                  setSelectedStaffForTask({ ...selectedStaffForTask, new: '' });
                                }}
                                style={{
                                  background: 'var(--color-critical)',
                                  color: '#fff',
                                  borderColor: 'var(--color-critical)',
                                  fontSize: '0.8rem',
                                  padding: '0.4rem 0.8rem',
                                }}
                              >
                                Assign Staff
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div
              className="card flex-1 flex flex-col items-center justify-center text-center"
              style={{
                padding: '4rem 2rem',
                border: '1px dashed rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'rgba(59,130,246,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  border: '1px solid rgba(59,130,246,0.1)',
                }}
              >
                <Globe size={40} color="var(--color-info)" className="animate-pulse" />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>System Status: Nominal</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                All sectors reporting no active emergencies. Monitoring in real-time.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW: Timeline + Live Event Feed + Resolved Accordion ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: '1.5rem' }}>
        {/* Live timeline — per-incident, wired to real data */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '340px' }}>
          <div
            style={{
              borderBottom: '1px solid var(--border-light)',
              paddingBottom: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <MessageSquare size={14} />
              {selectedIncident
                ? `Timeline — ${selectedIncident.type?.toUpperCase()} @ ${selectedIncident.location}`
                : 'Incident Timeline'}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-success)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Activity size={10} className="animate-pulse" /> LIVE
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <TimelineFeed events={selectedIncident?.timeline || []} />
          </div>
        </div>

        {/* ── LIVE EVENT FEED — /logs stream ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '340px' }}>
          <div
            style={{
              borderBottom: '1px solid var(--border-light)',
              paddingBottom: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Radio size={14} color="var(--color-critical)" />
              Live Event Feed
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {logs.length} events
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No events yet.
              </div>
            ) : (
              logs.map((log) => {
                // Colour by severity
                const severityStyle = {
                  critical: { color: 'var(--color-critical)', dot: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
                  high:     { color: 'var(--color-high)',     dot: '#f97316', bg: 'rgba(249,115,22,0.06)' },
                  medium:   { color: 'var(--color-medium)',   dot: '#eab308', bg: 'rgba(234,179,8,0.06)'  },
                  warning:  { color: 'var(--color-medium)',   dot: '#eab308', bg: 'rgba(234,179,8,0.06)'  },
                  info:     { color: 'var(--color-info)',     dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
                  low:      { color: 'var(--color-info)',     dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
                  success:  { color: 'var(--color-success)',  dot: '#22c55e', bg: 'rgba(34,197,94,0.06)'  },
                }[log.severity] || { color: 'var(--text-muted)', dot: '#64748b', bg: 'transparent' };

                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'flex-start',
                      padding: '0.5rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      background: severityStyle.bg,
                      borderLeft: `3px solid ${severityStyle.dot}`,
                      flexShrink: 0,
                    }}
                  >
                    {/* Severity dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: severityStyle.dot,
                        marginTop: '5px',
                        flexShrink: 0,
                        boxShadow: `0 0 6px ${severityStyle.dot}`,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-main)',
                          lineHeight: 1.4,
                          fontWeight: 500,
                          wordBreak: 'break-word',
                        }}
                      >
                        {log.message}
                      </div>
                      <div
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.2rem',
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: severityStyle.color, fontWeight: 700, textTransform: 'uppercase' }}>
                          {log.type?.replace(/_/g, ' ')}
                        </span>
                        <span>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resolved incidents accordion */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '340px' }}>
          <button
            id="toggle-resolved-btn"
            onClick={() => setShowResolved((v) => !v)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              padding: 0,
              marginBottom: showResolved ? '1rem' : 0,
              width: '100%',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Resolved ({resolvedIncidents.length})
            </span>
            {showResolved ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showResolved && (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {resolvedIncidents.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  No resolved incidents yet.
                </p>
              ) : (
                resolvedIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-light)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {inc.type?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 700 }}>
                        ✓ RESOLVED
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                      <span><Globe size={11} style={{ display: 'inline' }} /> {inc.location}</span>
                      <span>
                        <Clock size={11} style={{ display: 'inline' }} />{' '}
                        {inc.resolvedAt
                          ? new Date(inc.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .incident-list-item:hover {
          background: rgba(59,130,246,0.05) !important;
        }
        .health-dot {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 800;
          color: rgba(255,255,255,0.4);
        }
        .health-dot.active { color: #10b981; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
