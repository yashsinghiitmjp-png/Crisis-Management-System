// Pure function to find an available staff member for a specific incident type
export const assignTaskToStaff = (currentStaffList, incidentType) => {
  // 1. Find staff members who match the role and are available
  const availableCandidates = currentStaffList.filter(
    (staff) => staff.role === incidentType && staff.isAvailable
  );

  // 2. If no one is matching/available, return null (causes "pending assignment" state)
  if (availableCandidates.length === 0) {
    return null;
  }

  // 3. For prototype, simply pick the first available candidate
  // In a real scenario, this could use geolocation tracking (closest distance)
  return availableCandidates[0].id;
};
