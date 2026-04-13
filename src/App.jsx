import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { DatabaseProvider } from './services/mockDatabase';

import GuestSOS from './pages/GuestSOS';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <DatabaseProvider>
      <Router>
        <div className="app-container">
          <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', gap: '2rem', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div style={{ fontWeight: 'bold', color: 'white' }}>Crisis System</div>
            <div className="flex gap-4">
              <Link to="/guest" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Guest Portal</Link>
              <Link to="/staff" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Staff Portal</Link>
              <Link to="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Admin Portal</Link>
            </div>
          </nav>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<div style={{textAlign:'center', marginTop: '5rem'}}><h2>Welcome to the Prototype</h2><p>Use the navigation above to test the different roles.</p></div>} />
              <Route path="/guest" element={<GuestSOS />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
        </div>
      </Router>
    </DatabaseProvider>
  );
}

export default App;
