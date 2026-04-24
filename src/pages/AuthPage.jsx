import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, UserCheck, ShieldClose, ShieldCheck, Mail, Lock, User, Briefcase, ChevronLeft } from 'lucide-react';

const redirectByRole = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/guest';
};

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, resetPassword, provisionDemoUsers } = useAuth();
  const [provisioning, setProvisioning] = useState(false);

  const handleProvisionDemos = async () => {
    setProvisioning(true);
    setError('');
    setSuccess('');
    const result = await provisionDemoUsers();
    if (!result.ok) {
      setError(`Failed to set up demo accounts: ${result.message}`);
    } else {
      setSuccess(`Setup complete! Created: ${result.created}, Existing: ${result.existing}. You can now log in.`);
    }
    setProvisioning(false);
  };

  // Decide initial mode based on url
  const initialMode = location.pathname.includes('signup') ? 'register' : 'login';

  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [step, setStep] = useState('details'); // 'details' | 'verifying' (for register only)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'guest',
    staffId: 's1',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [hasSignedUp, setHasSignedUp] = useState(() => {
    // Check localStorage on mount to remember if they already signed up
    return localStorage.getItem('crisisSync_hasSignedUp') === 'true';
  });
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);

  // Sync mode state when location changes (if navigating directly)
  useEffect(() => {
    const newMode = location.pathname.includes('signup') ? 'register' : 'login';

    // Auto-redirect to login if they already signed up and try to hit /signup
    if (newMode === 'register' && (hasSignedUp || location.state?.hasSignedUp)) {
      handleToggleMode('login', { hasSignedUp: true });
      return;
    }

    setMode(newMode);
    setStep('details');
    setError('');
    setSuccess('');
  }, [location.pathname, hasSignedUp]);

  // Push new path to history if user toggles view, preventing black screen back-nav issues
  const handleToggleMode = (newMode, navigationState = {}) => {
    setMode(newMode);
    setStep('details');
    setError('');
    setSuccess('');
    // ... logic for navigation ...
    navigate(newMode === 'login' ? '/signin' : '/signup', {
      state: navigationState,
      replace: true
    });
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const result = await signIn({ email: form.email, password: form.password });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate(redirectByRole(result.user.role));
  };

  const handleRegisterDetailsSubmit = (event) => {
    event.preventDefault();
    setError('');
    setStep('verifying');
  };

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    const joinedCode = verifyCode.join('');

    if (joinedCode.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    const createResult = await signUp(form);
    if (!createResult.ok) {
      setError(createResult.message);
      setStep('details');
      return;
    }

    // Permanently remember that this user has signed up
    localStorage.setItem('crisisSync_hasSignedUp', 'true');
    setHasSignedUp(true);

    // Switch to Sign In screen immediately with no waiting period
    navigate('/signin', { state: { hasSignedUp: true }, replace: true });
    setForm(prev => ({ ...prev, password: '' })); // Clear password for security
  };


  const updateCode = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...verifyCode];
    next[idx] = val;
    setVerifyCode(next);

    if (val && idx < 5) {
      const nextInput = document.getElementById(`code-${idx + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="unified-auth-container">
      <div className="auth-mesh-bg"></div>

      <div className="unified-auth-card">
        {regSuccess && (
          <div className="auth-success-overlay animate-fade-in">
            <div className="success-alert-card">
              <div className="success-icon-container">
                <ShieldCheck className="success-icon" size={32} />
              </div>
              <h3>Account Secured</h3>
              <p>Your portal credentials have been successfully registered in the crisis network.</p>
              <div className="loading-bar-mini"></div>
              <span className="success-footer">Redirecting to Signature Portal...</span>
            </div>
          </div>
        )}

        {/* Navigation / Header */}
        <div className="auth-header-bar">
          <button className="auth-back-nav" onClick={() => navigate('/')}>
            <ChevronLeft size={20} />
            Back to Home
          </button>
          <div className="auth-brand">
            <span className="auth-logo-dot"></span>
            CrisisSync
          </div>
        </div>

        {/* Toggle between Sign In / Sign Up - Hidden if user just signed up or resetting password */}
        {step === 'details' && mode !== 'forgot-password' && !hasSignedUp && !location.state?.hasSignedUp && (
          <div className="auth-toggle-group">
            <button
              className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => handleToggleMode('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-toggle-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => handleToggleMode('register')}
            >
              Sign Up
            </button>
          </div>
        )}

        <div className="auth-content-wrapper">
          {mode === 'login' ? (
            <div className="auth-view animate-fade-in">
              <div className="auth-view-header">
                <h2>Welcome Back</h2>
                <p>Sign in to access your crisis management dashboard.</p>
              </div>

              {(location.state?.hasSignedUp || hasSignedUp) && (
                <div className="auth-success-msg">
                  <ShieldCheck size={18} />
                  <span>Account created successfully!</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="unified-auth-form">
                <div className="input-group">
                  <label className="input-label"><Mail size={14} /> Email Address</label>
                  <input
                    className="glass-input"
                    type="email"
                    placeholder="e.g. user@email.com"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label"><Lock size={14} /> Password</label>
                  <input
                    className="glass-input"
                    type="password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>

                <button
                  type="button"
                  className="auth-secondary-link"
                  onClick={() => setMode('forgot-password')}
                >
                  Forgot password?
                </button>

                {error && <div className="auth-error"><ShieldClose size={16} /> {error}</div>}

                <button className="btn-primary auth-submit-btn" type="submit">
                  Sign In <ArrowRight size={18} />
                </button>
              </form>

              <div className="demo-credentials-card">
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5 style={{ margin: 0 }}>Demo Access (Password: crisis123)</h5>
                  <button
                    type="button"
                    onClick={handleProvisionDemos}
                    disabled={provisioning}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                  >
                    {provisioning ? 'Fixing...' : 'Fix Demo Logins'}
                  </button>
                </div>
                <div className="demo-rows">
                  <div><span>Admin:</span> admin@demo.com</div>
                  <div><span>Staff:</span> staff@demo.com</div>
                  <div><span>Guest:</span> guest@demo.com</div>
                </div>
                {success && <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-success)' }}>{success}</div>}
              </div>
            </div>
          ) : mode === 'forgot-password' ? (
            <div className="auth-view animate-fade-in">
              <button className="auth-back-nav-btn" onClick={() => setMode('login')}>
                <ChevronLeft size={18} /> Back to Sign In
              </button>

              <div className="auth-view-header">
                <h2>Recover Password</h2>
                <p>Enter your email and we'll send you a link to reset your password.</p>
              </div>

              {success ? (
                <div className="auth-success-msg">
                  <ShieldCheck size={18} />
                  <span>{success}</span>
                </div>
              ) : (
                <form onSubmit={handleResetSubmit} className="unified-auth-form">
                  <div className="input-group">
                    <label className="input-label"><Mail size={14} /> Email Address</label>
                    <input
                      className="glass-input"
                      type="email"
                      placeholder="e.g. user@email.com"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  {error && <div className="auth-error"><ShieldClose size={16} /> {error}</div>}

                  <button className="btn-primary auth-submit-btn" type="submit">
                    Send Reset Link <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="auth-view animate-fade-in">
              {step === 'details' ? (
                <>
                  <div className="auth-view-header">
                    <h2>Join Us</h2>
                    <p>Create an account to start using the app.</p>
                  </div>
                  <form onSubmit={handleRegisterDetailsSubmit} className="unified-auth-form">
                    <div className="input-group">
                      <label className="input-label"><User size={14} /> Full Name</label>
                      <input
                        className="glass-input"
                        type="text"
                        placeholder="e.g. Jane Doe"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label"><Mail size={14} /> Email Address</label>
                      <input
                        className="glass-input"
                        type="email"
                        placeholder="e.g. jane@company.com"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label"><Lock size={14} /> Password</label>
                      <input
                        className="glass-input"
                        type="password"
                        placeholder="Create a secure password"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        required
                      />
                    </div>

                    {error && <div className="auth-error"><ShieldClose size={16} /> {error}</div>}

                    <button className="btn-primary auth-submit-btn" type="submit" style={{ marginTop: '0.5rem' }}>
                      Next Step <ArrowRight size={18} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="verification-step animate-slide-left">
                  <button className="auth-back-nav" onClick={() => { setStep('details'); setError(''); }} style={{ position: 'relative', top: 0, left: 0, marginBottom: '1.5rem', padding: 0 }}>
                    <ChevronLeft size={20} /> Back
                  </button>

                  <div className="auth-view-header">
                    <h2>Check Your Email</h2>
                    <p>Enter the 6-digit code we sent to <strong>{form.email}</strong></p>
                  </div>

                  <form onSubmit={handleVerifySubmit} className="unified-auth-form">
                    <div className="verify-code-grid-new">
                      {verifyCode.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`code-${idx}`}
                          className="glass-code-input"
                          maxLength="1"
                          value={digit}
                          onChange={(e) => updateCode(e.target.value, idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !digit && idx > 0) {
                              document.getElementById(`code-${idx - 1}`)?.focus();
                            }
                          }}
                          required
                        />
                      ))}
                    </div>

                    {error && <div className="auth-error"><ShieldClose size={16} /> {error}</div>}

                    <button className="btn-primary auth-submit-btn" type="submit">
                      Create Account <Lock size={18} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
