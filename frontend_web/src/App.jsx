import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CommandHome from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import ControlRoom from './pages/admin/ControlRoom';
import VolunteerPage from './pages/VolunteerPage';
import VolunteerDashboard from './pages/VolunteerDashboard';
import VolunteerDashboardWrapper from './pages/VolunteerDashboardWrapper';
import DonorPage from './pages/DonorPage';
import VictimPage from './pages/VictimPage';
import SOSPage from './pages/SOSPage';
import ManualPage from './pages/ManualPage';

// Returns the default home path for a given role
const roleHome = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'volunteer') return '/field';
  return '/home';
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    // Save the attempted path so we can restore it after login
    localStorage.setItem('lastRoute', location.pathname);
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  // Persist current route so refresh restores it
  localStorage.setItem('lastRoute', location.pathname);
  return children;
};

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      {/* Login / root — if already logged in, send to saved route or role default */}
      <Route
        path="/"
        element={
          user
            ? <Navigate to={localStorage.getItem('lastRoute') || roleHome(user.role)} replace />
            : <Login />
        }
      />

      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/control-room" element={<ProtectedRoute allowedRoles={['admin']}><ControlRoom /></ProtectedRoute>} />
      <Route path="/volunteer" element={<ProtectedRoute allowedRoles={['admin']}><VolunteerPage /></ProtectedRoute>} />
      <Route path="/victims" element={<ProtectedRoute allowedRoles={['admin']}><VictimPage /></ProtectedRoute>} />

      {/* Volunteer field portal */}
      <Route path="/field" element={<ProtectedRoute allowedRoles={['volunteer']}><VolunteerDashboardWrapper /></ProtectedRoute>} />

      {/* Citizen routes */}
      <Route path="/home" element={<ProtectedRoute><CommandHome /></ProtectedRoute>} />
      <Route path="/donor" element={<ProtectedRoute><DonorPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sos" element={<ProtectedRoute><SOSPage /></ProtectedRoute>} />
      <Route path="/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />

      {/* Fallback — preserve logged-in user's last route, otherwise go to login */}
      <Route
        path="*"
        element={
          user
            ? <Navigate to={localStorage.getItem('lastRoute') || roleHome(user.role)} replace />
            : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
