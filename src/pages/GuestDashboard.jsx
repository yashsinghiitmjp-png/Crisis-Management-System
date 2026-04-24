import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeIncidents, useMyIncident } from '../services/database';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert, Flame, Plus, Loader, Sparkles, MapPin,
  Phone, Info, CheckCircle, AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Step tracker config
// ---------------------------------------------------------------------------
const STATUS_STEPS = [
  { key: 'active', label: 'Created', desc: 'Alert sent to command' },
  { key: 'assigned', label: 'Assigned', desc: 'Responder dispatched' },
  { key: 'in_progress', label: 'In Progress', desc: 'Help is on the way' },
  { key: 'resolved', label: 'Resolved', desc: 'Situation resolved' },
];

const stepIndex = (status) => {
  const map = { active: 0, assigned: 1, in_progress: 2, resolved: 3 };
  return map[status] ?? 0;
};

// ---------------------------------------------------------------------------
// Step Tracker Component
// ---------------------------------------------------------------------------
const StepTracker = ({ currentStatus }) => {
  const current = stepIndex(currentStatus);
  return (
    <div className="step-tracker">
      {STATUS_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step.key}>
            <div className={`step-item ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <div className="step-circle">
                {done ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
              </div>
              <div className="step-label">{step.label}</div>
              {active && <div className="step-desc">{step.desc}</div>}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`step-connector ${done ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SOS Type buttons config
// ---------------------------------------------------------------------------


const SOS_TYPES = [
  {
    type: 'fire',
    label: 'Fire / Smoke',
    sub: 'Evacuation required',
    icon: Flame,
    colorClass: 'sos-card fire',
  },
  {
    type: 'medical',
    label: 'Medical',
    sub: 'Injury or health crisis',
    icon: Plus,
    colorClass: 'sos-card medical',
  },
  {
    type: 'security',
    label: 'Threat',
    sub: 'Immediate security help',
    icon: ShieldAlert,
    colorClass: 'sos-card security',
  },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const GuestDashboard = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || null;

  const { createIncident, createIncidentFromRaw } = useRealtimeIncidents();

  // --- Local state ---
  const [location, setLocation] = useState('Room 402');
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle');             // idle | confirming | submitting | success
  const [selectedType, setSelectedType] = useState(null);
  const [isRawMode, setIsRawMode] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // Track the last submitted incident for live status
  const [submittedIncidentId, setSubmittedIncidentId] = useState(null);
  const [assignedStaff, setAssignedStaff] = useState(null);
  const [lastIncident, setLastIncident] = useState(null);

  // Live status from the incidents_by_user index
  const liveStatus = useMyIncident(userId, submittedIncidentId);

  // Geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`),
        () => { } // silently fail
      );
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (status !== 'confirming' || countdown === null) return;
    if (countdown === 0) {
      confirmSOS();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss success when resolved
  useEffect(() => {
    if (liveStatus?.status === 'resolved') {
      const t = setTimeout(() => resetState(), 8000);
      return () => clearTimeout(t);
    }
  }, [liveStatus?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetState = useCallback(() => {
    setStatus('idle');
    setSubmittedIncidentId(null);
    setLastIncident(null);
    setAssignedStaff(null);
    setDescription('');
    setSelectedType(null);
    setIsRawMode(false);
    setCountdown(null);
  }, []);

  const handleTypeSelect = (type) => {
    if (status !== 'idle') return;
    setSelectedType(type);
    setIsRawMode(false);
    setStatus('confirming');
    setCountdown(5);
  };

  const handleRawTrigger = () => {
    if (!description.trim() || status !== 'idle') return;
    setIsRawMode(true);
    setStatus('confirming');
    setCountdown(5);
  };

  const cancelConfirm = () => {
    setStatus('idle');
    setIsRawMode(false);
    setCountdown(null);
  };

  const confirmSOS = useCallback(async () => {
    setCountdown(null);
    setStatus('submitting');
    try {
      let incident;
      if (isRawMode) {
        incident = await createIncidentFromRaw(description, location, userId);
      } else {
        incident = await createIncident(selectedType, location, description, userId);
      }

      setLastIncident(incident);
      setSubmittedIncidentId(incident.id);

      const firstTask = incident.tasks
        ? Object.values(incident.tasks)[0]
        : null;
      if (firstTask?.staff_id) {
        setAssignedStaff(firstTask.staff_name || `Unit ${firstTask.staff_id}`);
      }

      setStatus('success');
      setDescription('');
      setIsRawMode(false);
    } catch (err) {
      console.error('Failed to create incident:', err);
      setStatus('idle');
    }
  }, [isRawMode, description, location, selectedType, userId, createIncident, createIncidentFromRaw]);

  // Priority colour for success panel border
  const priorityColor = {
    critical: 'var(--color-critical)',
    high: 'var(--color-high)',
    medium: 'var(--color-medium)',
    low: 'var(--color-info)',
  }[lastIncident?.priority] || 'var(--color-success)';

  return (
    <div className="guest-dashboard-wrapper animate-fade-in">
      {/* Header */}
      <header className="guest-header">
        <div className="header-info">
          <h1>Safety Dashboard</h1>
          <p className="time">{new Date().toLocaleTimeString()}</p>
        </div>
        <div className="status-badge-premium" style={{ borderColor: 'var(--color-success)' }}>
          <span style={{ color: 'var(--color-success)' }}>
            <CheckCircle size={20} />
          </span>
          <div className="status-text">
            <span className="label" style={{ color: 'var(--color-success)' }}>
              System Ready
            </span>
            <span className="desc">Emergency response standing by</span>
          </div>
        </div>
      </header>

      <div className="guest-grid">
        {/* Main SOS Column */}
        <section className="sos-section">
          <div className="section-header">
            <AlertCircle size={20} color="var(--color-critical)" />
            <h2>Emergency Assistance</h2>
          </div>
          <p className="intro">
            Tap your emergency type for immediate dispatch. Help will be sent automatically.
          </p>

          {/* Large SOS Buttons */}
          <div className="sos-grid">
            {SOS_TYPES.map(({ type, label, sub, icon: Icon, colorClass }) => (
              <button
                key={type}
                className={`${colorClass} sos-btn-large ${status === 'confirming' && selectedType === type ? 'active' : ''
                  }`}
                onClick={() => handleTypeSelect(type)}
                disabled={status !== 'idle'}
                id={`sos-btn-${type}`}
              >
                <div className="sos-icon-wrap">
                  <Icon size={56} />
                </div>
                <div className="sos-content">
                  <h3>{label}</h3>
                  <p>{sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Optional description + raw trigger */}
          {status === 'idle' && (
            <div
              className="raw-message-input glass-panel animate-slide-up"
              style={{ marginTop: '2rem', padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div
                  style={{
                    color: 'var(--color-info)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Describe Your Situation</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Optional — Gemini AI will analyse for faster response.
                  </p>
                </div>
              </div>

              <textarea
                id="guest-description-input"
                placeholder="e.g., I see smoke near the elevator, or someone tripped and hurt their ankle..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: '1rem',
                  fontSize: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-main)',
                  resize: 'none',
                  marginBottom: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-info)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
              />

              <button
                id="guest-signal-btn"
                className="btn-primary auth-submit-btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                onClick={handleRawTrigger}
                disabled={!description.trim()}
              >
                <ShieldAlert size={18} />
                Signal for Help
              </button>
            </div>
          )}

          {/* ---- OVERLAYS ---- */}

          {/* Confirming / Countdown */}
          {status === 'confirming' && (
            <div className="sos-overlay animate-fade-in">
              <div className="confirm-panel glass-panel">
                <AlertCircle size={48} color="var(--color-critical)" />
                <h2>Dispatching in {countdown}s…</h2>
                <p>
                  Sending responders to <strong>{location}</strong>{' '}
                  {isRawMode ? 'for the reported situation' : `for ${selectedType?.toUpperCase()}`}.
                </p>
                <button
                  id="guest-change-location-btn"
                  className="btn nav-btn-outline"
                  style={{ marginBottom: '1rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => {
                    setCountdown(null);
                    setIsEditingLocation(true);
                  }}
                >
                  Change Location
                </button>
                <div className="action-btns">
                  <button
                    id="guest-cancel-btn"
                    className="btn nav-btn-outline"
                    onClick={cancelConfirm}
                  >
                    Cancel
                  </button>
                  <button
                    id="guest-dispatch-now-btn"
                    className="btn-primary auth-submit-btn pulsate"
                    onClick={() => { setCountdown(0); }}
                  >
                    Dispatch Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Location Editor */}
          {isEditingLocation && (
            <div className="sos-overlay animate-fade-in" style={{ zIndex: 10001 }}>
              <div className="confirm-panel glass-panel" style={{ maxWidth: '400px' }}>
                <h3>Update Location</h3>
                <p>Enter your exact room or area name.</p>
                <input
                  id="guest-location-input"
                  type="text"
                  className="glass-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ marginBottom: '1.5rem', textAlign: 'center' }}
                />
                <button
                  id="guest-save-location-btn"
                  className="btn-primary auth-submit-btn"
                  onClick={() => {
                    setIsEditingLocation(false);
                    setCountdown(5); // restart countdown
                  }}
                >
                  Save Location
                </button>
              </div>
            </div>
          )}

          {/* Submitting */}
          {status === 'submitting' && (
            <div className="sos-overlay">
              <div className="processing-panel glass-panel">
                <Loader size={48} className="animate-spin" color="var(--color-info)" />
                <h2>Broadcasting SOS</h2>
                <div className="ai-tag">
                  <Sparkles size={16} />
                  <span>Gemini AI Classifying Priority</span>
                </div>
              </div>
            </div>
          )}

          {/* Success + Live Status Tracker */}
          {status === 'success' && lastIncident && (
            <div className="sos-overlay animate-fade-in">
              <div
                className="success-panel glass-panel"
                style={{ borderTop: `4px solid ${priorityColor}` }}
              >
                <div
                  className="success-icon"
                  style={{
                    color: 'var(--color-success)',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle size={56} />
                </div>
                <h2 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                  Help is on the way
                </h2>
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                  }}
                >
                  Responders have been notified. Track your request below.
                </p>

                {/* Live Step Tracker */}
                <StepTracker currentStatus={liveStatus?.status || 'active'} />

                {/* Assigned responder */}
                {assignedStaff ? (
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-success)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                      }}
                    >
                      Responder Dispatched
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {assignedStaff} is en route.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-medium)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                      }}
                    >
                      Processing Assignment
                    </div>
                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                      Assigning nearest available responder…
                    </div>
                  </div>
                )}

                {/* AI Classification */}
                <div
                  className="ai-brief"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-light)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    className="ai-header"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <Sparkles size={14} color="var(--color-info)" />
                    <span style={{ fontWeight: 600 }}>AI Classification</span>
                  </div>
                  <div className="priority-row" style={{ marginBottom: '0.5rem' }}>
                    <span
                      className={`p-tag ${lastIncident.priority}`}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        fontWeight: 600,
                      }}
                    >
                      {lastIncident.priority?.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                    {lastIncident.aiReasoning}
                  </p>
                </div>

                <button
                  id="guest-close-panel-btn"
                  className="btn nav-btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={resetState}
                >
                  Close Panel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="guest-sidebar">
          <div className="info-card glass-panel">
            <h3>
              <Info size={18} /> Safety Guides
            </h3>
            <ul className="guide-list">
              <li>
                <div className="guide-icon">
                  <Flame size={16} />
                </div>
                <div className="guide-text">
                  <span>Fire Evacuation</span>
                  <p>Stairs only, follow green signs.</p>
                </div>
              </li>
              <li>
                <div className="guide-icon">
                  <Plus size={16} />
                </div>
                <div className="guide-text">
                  <span>Medical First Aid</span>
                  <p>AED located in lobby and Level 4.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="info-card glass-panel">
            <h3>
              <Phone size={18} /> Venue Contact
            </h3>
            <div className="contact-item">
              <span>Security Desk</span>
              <p>Ext. 9911</p>
            </div>
            <div className="contact-item">
              <span>Front Desk</span>
              <p>Ext. 0</p>
            </div>
          </div>

          <div
            className="location-card glass-panel"
            onClick={() => setIsEditingLocation(true)}
            style={{ cursor: 'pointer' }}
          >
            <MapPin size={24} color="var(--color-info)" />
            <div className="loc-text">
              <span>Current Location</span>
              <strong>{location}</strong>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-info)' }}>
                Click to change
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GuestDashboard;

