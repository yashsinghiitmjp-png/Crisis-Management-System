import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { DatabaseProvider } from './services/database';
import { AuthProvider } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <Router>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </Router>
      </AuthProvider>
    </DatabaseProvider>
  );
}

export default App;
