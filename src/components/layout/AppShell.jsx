import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Home, Grid, User as UserIcon, LogOut } from 'lucide-react';

const roleRoutes = {
  admin: '/admin',
  staff: '/staff',
  guest: '/guest',
};

const AppShell = ({ children }) => {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Show welcome toast on first sign-in of the session
    if (currentUser && !sessionStorage.getItem('welcomeShown')) {
      setShowToast(true);
      sessionStorage.setItem('welcomeShown', 'true');
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    sessionStorage.removeItem('welcomeShown'); // Reset for next session
    await signOut();
    navigate('/signin');
  };

  const isFullBleed = location.pathname === '/' || location.pathname === '/signin' || location.pathname === '/signup';

  return (
    <div className="app-container">
      {!isFullBleed && (
        <nav className={`premium-nav ${scrolled ? 'nav-scrolled' : ''}`}>
          <div className="nav-brand" onClick={() => navigate('/')}>
            <ShieldAlert className="nav-brand-icon" size={24} />
            <span>CrisisSync</span>
          </div>

          <div className="nav-links-center">
            <Link to="/" className="nav-link-dynamic">
              <Home size={16} /> Home
            </Link>
            {currentUser && (
              <Link to={roleRoutes[currentUser.role]} className={`nav-link-dynamic ${location.pathname.startsWith(roleRoutes[currentUser.role]) ? 'active' : ''}`}>
                <Grid size={16} /> Dashboard
              </Link>
            )}
          </div>

          <div className="nav-actions">
            {currentUser ? (
              <div className="nav-user-controls">
                <div className="nav-user-badge">
                  <UserIcon size={14} />
                  <span className="user-name">{currentUser.name}</span>
                  <span className={`role-dot dot-${currentUser.role}`}></span>
                </div>
                <button className="nav-btn-outline" onClick={handleSignOut}>
                  <LogOut size={16} /> Exit
                </button>
              </div>
            ) : (
              <div className="nav-auth-controls">
                <Link to="/signin" className="nav-btn-ghost">Sign In</Link>
                {localStorage.getItem('crisisSync_hasSignedUp') !== 'true' && (
                  <Link to="/signup" className="nav-btn-primary">Get Started</Link>
                )}
              </div>
            )}
          </div>
        </nav>
      )}

      <main className={isFullBleed ? '' : 'main-content main-with-nav'}>{children}</main>

      {showToast && currentUser && (
        <div className="welcome-toast">
          <div className="success-icon-container" style={{ width: 32, height: 32 }}>
            <UserIcon size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>
              Welcome back, {currentUser.name}!
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              You have signed in successfully.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppShell;
