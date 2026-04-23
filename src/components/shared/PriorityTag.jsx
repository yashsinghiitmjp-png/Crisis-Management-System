import React from 'react';

const PriorityTag = ({ priority }) => {
  const getStyle = () => {
    switch(priority?.toLowerCase()) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-critical)', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'high':
        return { bg: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-high)', border: '1px solid rgba(249, 115, 22, 0.2)' };
      case 'medium':
        return { bg: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-medium)', border: '1px solid rgba(234, 179, 8, 0.2)' };
      default:
        return { bg: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
    }
  };

  const style = getStyle();

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.75rem',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundColor: style.bg,
      color: style.color,
      border: style.border
    }}>
      {priority}
    </span>
  );
};

export default PriorityTag;
