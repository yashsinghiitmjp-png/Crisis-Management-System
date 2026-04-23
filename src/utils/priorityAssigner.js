// Map incident types to absolute urgency levels
// Used to color-code UI and sort dashboards
export const assignPriority = (incidentType) => {
  const typeMap = {
    fire: 'critical',
    medical: 'high',
    security: 'medium'
  };

  return typeMap[incidentType.toLowerCase()] || 'medium';
};
