import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = lazy(() => import('../pages/HomePage'));
const AuthPage = lazy(() => import('../pages/AuthPage'));
const GuestDashboard = lazy(() => import('../pages/GuestDashboard'));
const StaffDashboard = lazy(() => import('../pages/StaffDashboard'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));

const ProtectedRoute = ({ role, children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (role && currentUser.role !== role) {
    if (!currentUser.role) {
      return (
        <div className="unified-auth-container" style={{ flexDirection: 'column', gap: '1.5rem' }}>
          <div className="auth-mesh-bg"></div>
          <div className="auth-logo-dot" style={{ width: '24px', height: '24px' }}></div>
          <p style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 600 }}>
            SYNCHRONIZING SECURITY PROFILE
          </p>
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { currentUser } = useAuth();

  const getDashboardPath = (user) => {
    if (!user) return '/signin';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'staff') return '/staff';
    return '/guest';
  };

  return (
    <Suspense
      fallback={(
        <div className="unified-auth-container" style={{ flexDirection: 'column', gap: '1.5rem' }}>
          <div className="auth-mesh-bg"></div>
          <div className="auth-logo-dot" style={{ width: '24px', height: '24px' }}></div>
          <p style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 600 }}>
            LOADING CRISISSYNC MODULES
          </p>
        </div>
      )}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={currentUser ? <Navigate to={getDashboardPath(currentUser)} replace /> : <AuthPage />} />
        <Route path="/signup" element={currentUser ? <Navigate to={getDashboardPath(currentUser)} replace /> : <AuthPage />} />

        <Route
          path="/guest"
          element={(
            <ProtectedRoute role="guest">
              <GuestDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/staff"
          element={(
            <ProtectedRoute role="staff">
              <StaffDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
