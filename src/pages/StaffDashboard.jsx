import React, { useState } from 'react';
import { useRealtimeTasks } from '../services/database';
import { useAuth } from '../context/AuthContext';
import {
  MapPin, Clock, CheckCircle, AlertTriangle, Play,
  Zap, Hash, Activity, Brain, Sparkles, ShieldAlert, Radio,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PRIORITY_COLORS = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-info)',
};

const PRIORITY_BG = {
  critical: 'rgba(239, 68, 68, 0.08)',
  high: 'rgba(239, 68, 68, 0.05)',
  medium: 'rgba(234, 179, 8, 0.06)',
  low: 'rgba(59, 130, 246, 0.06)',
};

const STATUS_LABEL = {
  pending: 'PENDING',
  acknowledged: 'ACKNOWLEDGED',
  in_progress: 'IN PROGRESS',
  done: 'DONE',
  pending_assignment: 'AWAITING ASSIGNMENT',
};

const STATUS_COLOR = {
  pending: 'var(--color-medium)',
  acknowledged: 'var(--color-info)',
  in_progress: 'var(--color-success)',
  done: 'rgba(255,255,255,0.3)',
  pending_assignment: 'var(--color-critical)',
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

// ---------------------------------------------------------------------------
// Task Card Component
// ---------------------------------------------------------------------------
const TaskCard = ({ task, onAcknowledge, onStart, onComplete, onRequestBackup, staffId }) => {
  const {
    incidentId,
    taskId,
    type,
    location,
    priority,
    status,
    incidentSeverity,
    incidentSummary,
    incidentKeywords,
    incidentRecommendations,
    incidentRecommendedActions,
    incidentEscalationMode,
    incidentEmsBrief,
    incidentCreatedAt,
    backup_requested,
    backup_requested_at,
  } = task;
  const priorityColor = PRIORITY_COLORS[priority] || 'var(--color-info)';
  const priorityBg = PRIORITY_BG[priority] || 'transparent';
  const isCritical = priority === 'critical';
  const severity = incidentSeverity || fallbackSeverityFromPriority(priority);
  const recommendationItems = incidentRecommendations?.recommendations || incidentRecommendedActions || [];
  const aiRequestsEscalation = incidentRecommendations?.escalation_needed;
  const hasBackupRequest = !!backup_requested;

  const shortRef = incidentId ? `#${incidentId.slice(-6).toUpperCase()}` : '';

  return (
    <div
      className={`staff-task-card ${isCritical ? 'critical-pulse' : ''}`}
      style={{
        background: priorityBg,
        borderLeft: `4px solid ${priorityColor}`,
      }}
    >
      {/* Top row: priority badge + status badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className={`priority-tag ${priority}`}
            style={{ fontSize: '0.75rem' }}
          >
            {priority?.toUpperCase()}
          </span>
          {shortRef && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <Hash size={10} />
              {shortRef}
            </span>
          )}
        </div>
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: STATUS_COLOR[status] || 'var(--text-muted)',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${STATUS_COLOR[status] || 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {STATUS_LABEL[status] || status.toUpperCase()}
        </span>
      </div>

      {/* Task type heading */}
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', lineHeight: 1.2 }}>
        {type?.toUpperCase()} Emergency
      </h2>

      {/* Location + time */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <MapPin size={14} style={{ color: priorityColor }} />
          {location || 'Unknown location'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={14} />
          {new Date(incidentCreatedAt || task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              color: 'var(--color-info)',
            }}
          >
            <Brain size={14} />
            AI Incident Brief
          </div>
          <div style={{ fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '0.6rem' }}>
            {incidentSummary || 'Awaiting AI summary for this incident.'}
          </div>
          {!!incidentKeywords?.length && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {incidentKeywords.slice(0, 4).map((keyword) => (
                <span
                  key={keyword}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(59,130,246,0.1)',
                    color: 'var(--color-info)',
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              color: severity > 7 ? 'var(--color-critical)' : 'var(--color-medium)',
            }}
          >
            <ShieldAlert size={14} />
            Severity & Escalation
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            Level {severity}/10
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {incidentEscalationMode === 'ai_auto' ? 'AI auto-backup enabled' : 'Admin review escalation'}
          </div>
          {aiRequestsEscalation && (
            <div
              style={{
                marginTop: '0.6rem',
                padding: '0.45rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--color-critical)',
                fontSize: '0.76rem',
                fontWeight: 700,
              }}
            >
              AI recommends escalation support
            </div>
          )}
          {incidentEmsBrief && (
            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              EMS brief ready for critical response handoff.
            </div>
          )}
          {hasBackupRequest && (
            <div
              style={{
                marginTop: '0.6rem',
                padding: '0.45rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245,158,11,0.12)',
                color: 'var(--color-medium)',
                fontSize: '0.76rem',
                fontWeight: 700,
              }}
            >
              Backup requested{backup_requested_at ? ` at ${new Date(backup_requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
          )}
        </div>
      </div>

      {!!recommendationItems.length && (
        <div
          style={{
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: '0.55rem',
              textTransform: 'uppercase',
              color: 'var(--color-info)',
            }}
          >
            <Sparkles size={14} />
            Recommended Response
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {recommendationItems.slice(0, 3).map((item, index) => (
              <div
                key={`${taskId}-rec-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  fontSize: '0.86rem',
                  lineHeight: 1.45,
                }}
              >
                <Radio size={13} style={{ marginTop: '3px', color: priorityColor, flexShrink: 0 }} />
                <span>{typeof item === 'object' ? item.action : item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasBackupRequest && status !== 'done' && (
        <button
          className="btn w-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--color-critical)',
            borderColor: 'rgba(239,68,68,0.25)',
          }}
          onClick={() => onRequestBackup(incidentId, taskId, staffId)}
        >
          <ShieldAlert size={18} />
          Need Escalation Support
        </button>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
        {/* THREE-STATE ACTIONS */}
        {status === 'pending' && (
          <button
            id={`ack-btn-${taskId}`}
            className={`btn w-full ${isCritical ? 'btn-critical animate-pulse-critical' : 'btn-primary'}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => onAcknowledge(incidentId, taskId, staffId)}
          >
            <AlertTriangle size={18} />
            Acknowledge
          </button>
        )}

        {status === 'acknowledged' && (
          <button
            id={`start-btn-${taskId}`}
            className="btn w-full"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'rgba(234, 179, 8, 0.15)',
              color: 'var(--color-medium)',
              borderColor: 'rgba(234, 179, 8, 0.3)',
            }}
            onClick={() => onStart(incidentId, taskId, staffId)}
          >
            <Play size={18} />
            Start — Mark In Progress
          </button>
        )}

        {status === 'in_progress' && (
          <button
            id={`complete-btn-${taskId}`}
            className="btn btn-success w-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => onComplete(incidentId, taskId, staffId)}
          >
            <CheckCircle size={18} />
            Mark as Resolved
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
const StaffDashboard = () => {
  const { currentUser } = useAuth();

  // Use Firebase Auth UID as staffId if available; fall back to staffId or default
  const initialStaffId = currentUser?.staffId || currentUser?.uid || 's1';
  const [currentStaffId, setCurrentStaffId] = useState(initialStaffId);

  const { myTasks, acknowledgeTask, startTask, completeTask, requestBackup } = useRealtimeTasks(currentStaffId);

  const activeCount = myTasks.length;

  return (
    <div className="staff-dashboard-wrapper animate-fade-in">
      {/* Header */}
      <div className="staff-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            My Tasks
            {activeCount > 0 && (
              <span
                style={{
                  background: 'var(--color-critical)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.55rem',
                  verticalAlign: 'middle',
                }}
              >
                {activeCount}
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Active assignments for staff ID:{' '}
            <strong style={{ color: 'var(--text-main)' }}>{currentStaffId}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-success)',
            }}
          >
            <Activity size={14} className="animate-pulse" />
            LIVE
          </div>

          {/* Dev mode staff switcher */}
          <div>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Dev: Switch Staff
            </label>
            <select
              id="staff-id-switcher"
              value={currentStaffId}
              onChange={(e) => setCurrentStaffId(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                color: 'white',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            >
              <option value="s1">John (Medical) [s1]</option>
              <option value="s2">Sarah (Security) [s2]</option>
              <option value="s3">Mike (Fire) [s3]</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="staff-task-list">
        {myTasks.length === 0 ? (
          <div className="staff-empty-state card">
            <div className="empty-icon">
              <Zap size={40} color="var(--color-info)" className="animate-pulse" />
            </div>
            <h3>No Active Assignments</h3>
            <p>You are on standby. Stay ready — tasks appear here in real-time.</p>
          </div>
        ) : (
          myTasks.map((task) => (
            <TaskCard
              key={task.taskId}
              task={task}
              staffId={currentStaffId}
              onAcknowledge={acknowledgeTask}
              onStart={startTask}
              onComplete={completeTask}
              onRequestBackup={requestBackup}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
