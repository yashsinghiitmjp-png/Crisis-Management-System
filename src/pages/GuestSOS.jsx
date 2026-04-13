import React, { useState } from 'react';
import { useRealtimeIncidents } from '../services/mockDatabase';
import { ShieldAlert, Flame, Plus, Loader } from 'lucide-react';

const GuestSOS = () => {
  const { createIncident } = useRealtimeIncidents();
  const [status, setStatus] = useState('idle'); // idle | confirming | submitting | success
  const [selectedType, setSelectedType] = useState(null);

  const handleTrigger = (type) => {
    setSelectedType(type);
    setStatus('confirming');
  };

  const confirmSOS = () => {
    setStatus('submitting');
    
    // Simulate network delay for retryHandler behavior (locked req)
    setTimeout(() => {
      createIncident(selectedType, 'Room 402'); // Hardcoded room for prototype
      setStatus('success');
      
      // Auto reset
      setTimeout(() => setStatus('idle'), 3000);
    }, 800);
  };

  if (status === 'success') {
    return (
      <div className="card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center', borderColor: 'var(--color-success)' }}>
        <h2 style={{ color: 'var(--color-success)' }}>SOS Sent</h2>
        <p>Help is on the way to Room 402.</p>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>Auto-refreshing...</p>
      </div>
    );
  }

  if (status === 'confirming') {
    return (
      <div className="card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-critical)' }}>Confirm {selectedType.toUpperCase()} Emergency</h2>
        <p style={{ marginBottom: '2rem' }}>Are you sure you want to trigger this alert?</p>
        <div className="flex gap-4 justify-center">
          <button className="btn" onClick={() => setStatus('idle')}>Cancel</button>
          <button className="btn btn-critical animate-pulse-critical" onClick={confirmSOS}>Confirm SOS</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h1>Emergency Assistance</h1>
      <p style={{ marginBottom: '2rem' }}>Tap the button corresponding to your emergency. Staff will be dispatched immediately.</p>
      
      <div className="grid gap-4">
        <button 
          className="card flex items-center gap-4" 
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-critical)' }}
          onClick={() => handleTrigger('fire')}
        >
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
            <Flame color="var(--color-critical)" size={32} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0 }}>Fire Emergency</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Smoke or active fire</p>
          </div>
        </button>

        <button 
          className="card flex items-center gap-4" 
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-high)' }}
          onClick={() => handleTrigger('medical')}
        >
          <div style={{ padding: '1rem', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderRadius: 'var(--radius-md)' }}>
            <Plus color="var(--color-high)" size={32} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0 }}>Medical Emergency</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Injury or health crisis</p>
          </div>
        </button>

        <button 
          className="card flex items-center gap-4" 
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--color-medium)' }}
          onClick={() => handleTrigger('security')}
        >
          <div style={{ padding: '1rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: 'var(--radius-md)' }}>
            <ShieldAlert color="var(--color-medium)" size={32} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0 }}>Security Alert</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Disturbance or threat</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default GuestSOS;
