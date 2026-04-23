import React, { useState, useEffect } from 'react';
import { useRealtimeIncidents } from '../services/database';
import { ShieldAlert, Flame, Plus, Loader, Sparkles, MapPin, Phone, Info, Bell, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';

const GuestDashboard = () => {
  const [lastIncident, setLastIncident] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rawMessage, setRawMessage] = useState('');
  const [location, setLocation] = useState('Room 402');
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isRawMode, setIsRawMode] = useState(false);
  const [status, setStatus] = useState('idle');
  const [selectedType, setSelectedType] = useState(null);
  const [assignedStaff, setAssignedStaff] = useState(null);
  const { createIncident, createIncidentFromRaw, incidents } = useRealtimeIncidents();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.log('Geolocation denied or failed.');
        }
      );
    }
  }, []);

  const handleTrigger = (type) => {
    if (status !== 'idle') return;
    setSelectedType(type);
    setStatus('confirming');
  };

  const handleRawTrigger = () => {
    if (!rawMessage.trim() || status !== 'idle') return;
    setIsRawMode(true);
    setStatus('confirming');
  };

  const confirmSOS = async () => {
    setStatus('submitting');
    try {
      let incident;
      if (isRawMode) {
        incident = await createIncidentFromRaw(rawMessage, location);
      } else {
        incident = await createIncident(selectedType, location);
      }
      setLastIncident(incident);

      if (incident.tasks && incident.tasks.length > 0) {
        const assignedTask = incident.tasks[0];
        if (assignedTask.staff_id) {
          setAssignedStaff(assignedTask.staff_name || `Unit ${assignedTask.staff_id}`);
        } else {
          setAssignedStaff(null);
        }
      }

      setStatus('success');
      setRawMessage('');
      setIsRawMode(false);
      setTimeout(() => { 
        setStatus('idle'); 
        setLastIncident(null); 
        setAssignedStaff(null);
      }, 10000);
    } catch (err) {
      console.error('Failed to create incident:', err);
      setStatus('idle');
    }
  };

  const getVenueStatus = () => {
    const active = incidents.filter(i => i.status !== 'resolved');
    if (active.length > 0) {
      return { 
        text: 'System Alert Active', 
        color: 'var(--color-high)', 
        icon: <Bell className="animate-pulse" size={20} />, 
        desc: 'Security teams are responding to an incident.' 
      };
    }
    return { 
      text: 'Venue Status: Secure', 
      color: 'var(--color-success)', 
      icon: <CheckCircle size={20} />, 
      desc: 'All systems are operating normally.' 
    };
  };

  const venueStatus = getVenueStatus();

  return (
    <div className="guest-dashboard-wrapper animate-fade-in">
      {/* Header Section */}
      <header className="guest-header">
        <div className="header-info">
          <h1>Safety Dashboard</h1>
          <p className="time">{currentTime.toLocaleTimeString()}</p>
        </div>
        <div className="status-badge-premium" style={{ borderColor: venueStatus.color }}>
          <span style={{ color: venueStatus.color }}>{venueStatus.icon}</span>
          <div className="status-text">
            <span className="label" style={{ color: venueStatus.color }}>{venueStatus.text}</span>
            <span className="desc">{venueStatus.desc}</span>
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
          <p className="intro">Select an option below for immediate dispatch of emergency personnel to your location.</p>

          <div className="sos-grid">
            <button 
              className={`sos-card fire ${status === 'confirming' && selectedType === 'fire' ? 'active' : ''}`}
              onClick={() => handleTrigger('fire')}
              disabled={status === 'submitting'}
            >
              <div className="sos-icon-wrap"><Flame size={40} /></div>
              <div className="sos-content">
                <h3>Fire / Smoke</h3>
                <p>Evacuation required</p>
              </div>
              <ChevronRight className="arrow" size={24} />
            </button>

            <button 
              className={`sos-card medical ${status === 'confirming' && selectedType === 'medical' ? 'active' : ''}`}
              onClick={() => handleTrigger('medical')}
              disabled={status === 'submitting'}
            >
              <div className="sos-icon-wrap"><Plus size={40} /></div>
              <div className="sos-content">
                <h3>Medical</h3>
                <p>Injury or health crisis</p>
              </div>
              <ChevronRight className="arrow" size={24} />
            </button>

            <button 
              className={`sos-card security ${status === 'confirming' && selectedType === 'security' ? 'active' : ''}`}
              onClick={() => handleTrigger('security')}
              disabled={status === 'submitting'}
            >
              <div className="sos-icon-wrap"><ShieldAlert size={40} /></div>
              <div className="sos-content">
                <h3>Threat</h3>
                <p>Immediate security help</p>
              </div>
              <ChevronRight className="arrow" size={24} />
            </button>
          </div>

          <div className="raw-message-input glass-panel animate-slide-up" style={{ marginTop: '2rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ color: 'var(--color-info)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Describe Your Situation</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Gemini AI will analyze your message for faster response.</p>
              </div>
            </div>
            
            <textarea 
              placeholder="e.g., I see smoke near the elevator, or Someone tripped and hurt their ankle..."
              value={rawMessage}
              onChange={(e) => setRawMessage(e.target.value)}
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '1rem',
                fontSize: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main)',
                resize: 'none',
                marginBottom: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-info)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
            />
            
            <button 
              className="btn-primary auth-submit-btn" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              onClick={handleRawTrigger}
              disabled={!rawMessage.trim() || status === 'submitting'}
            >
              <ShieldAlert size={18} />
              Signal for Help
            </button>
          </div>

          {/* Contextual Overlays for SOS States */}
          {status === 'confirming' && (
            <div className="sos-overlay animate-fade-in">
              <div className="confirm-panel glass-panel">
                <AlertCircle size={48} color="var(--color-critical)" />
                <h2>Confirm Alert?</h2>
                <p>
                  Dispatching responders to <strong>{location}</strong> 
                  {isRawMode ? ' for the reported situation.' : ` for ${selectedType.toUpperCase()}`}.
                </p>
                <button 
                  className="btn nav-btn-outline" 
                  style={{ marginBottom: '1rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setIsEditingLocation(true)}
                >
                  Change Location
                </button>
                <div className="action-btns">
                  <button className="btn nav-btn-outline" onClick={() => { setStatus('idle'); setIsRawMode(false); }}>Cancel</button>
                  <button className="btn-primary auth-submit-btn pulsate" onClick={confirmSOS}>Dispatch Now</button>
                </div>
              </div>
            </div>
          )}

          {isEditingLocation && (
            <div className="sos-overlay animate-fade-in" style={{ zIndex: 10001 }}>
              <div className="confirm-panel glass-panel" style={{ maxWidth: '400px' }}>
                <h3>Update Location</h3>
                <p>Enter your exact room or area name.</p>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ marginBottom: '1.5rem', textAlign: 'center' }}
                />
                <button className="btn-primary auth-submit-btn" onClick={() => setIsEditingLocation(false)}>Save Location</button>
              </div>
            </div>
          )}

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

          {status === 'success' && lastIncident && (
            <div className="sos-overlay animate-fade-in">
              <div className="success-panel glass-panel">
                <div className="success-icon" style={{ color: 'var(--color-success)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <CheckCircle size={56} />
                </div>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Alert Active</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Responders have been notified.</p>
                
                {assignedStaff ? (
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.25rem' }}>Responder Dispatched</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{assignedStaff} is en route.</div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-medium)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.25rem' }}>Processing Assignment</div>
                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Assigning nearest available responder...</div>
                  </div>
                )}

                <div className="ai-brief" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                  <div className="ai-header" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    <Sparkles size={14} color="var(--color-info)" />
                    <span style={{ fontWeight: 600 }}>AI Classification</span>
                  </div>
                  <div className="priority-row" style={{ marginBottom: '0.5rem' }}>
                    <span className={`p-tag ${lastIncident.priority}`} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', fontWeight: 600 }}>
                      {lastIncident.priority.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>{lastIncident.aiReasoning}</p>
                </div>
                <button className="btn nav-btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setStatus('idle'); setLastIncident(null); setAssignedStaff(null); }}>Close Panel</button>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar Info Column */}
        <aside className="guest-sidebar">
          <div className="info-card glass-panel">
            <h3><Info size={18} /> Safety Guides</h3>
            <ul className="guide-list">
              <li>
                <div className="guide-icon"><Flame size={16} /></div>
                <div className="guide-text">
                  <span>Fire Evacuation</span>
                  <p>Stairs only, follow green signs.</p>
                </div>
              </li>
              <li>
                <div className="guide-icon"><Plus size={16} /></div>
                <div className="guide-text">
                  <span>Medical First Aid</span>
                  <p>AED located in lobby and Level 4.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="info-card glass-panel">
            <h3><Phone size={18} /> Venue Contact</h3>
            <div className="contact-item">
              <span>Security Desk</span>
              <p>Ext. 9911</p>
            </div>
            <div className="contact-item">
              <span>Front Desk</span>
              <p>Ext. 0</p>
            </div>
          </div>

          <div className="location-card glass-panel" onClick={() => setIsEditingLocation(true)} style={{ cursor: 'pointer' }}>
            <MapPin size={24} color="var(--color-info)" />
            <div className="loc-text">
              <span>Current Location</span>
              <strong>{location}</strong>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-info)' }}>Click to change</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GuestDashboard;
