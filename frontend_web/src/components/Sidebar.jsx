import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { Map, MapPin } from 'lucide-react';

const adminNav = [
  { path: '/admin',     icon: '⚙️',  label: 'Command Center' },
  { path: '/admin/control-room', icon: <Map size={18} style={{marginTop: 5}} />, label: 'Live Control Room' },
  { path: '/volunteer', icon: '👥',  label: 'Teams Management' },
];

const citizenNav = [
  { path: '/home',      icon: '🏠',  label: 'Hub' },
  { path: '/donor',     icon: '💎',  label: 'Make a Donation' },
  { path: '/sos',       icon: '🚨',  label: 'Report Emergency' },
  { path: '/dashboard', icon: '📡',  label: 'Live Statistics' },
  { path: '/manual',    icon: '📖',  label: 'Safety Manual' },
];


export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = user?.role === 'admin' ? adminNav : citizenNav;
  const homeRoute = user?.role === 'admin' ? '/admin' : '/home';

  return (
    <div className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate(homeRoute)}>
        JEEVAN SETU
      </div>

      {navItems.map(item => (
        <div
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => {
            navigate(item.path);
          }}
          title={item.label}
        >
          <span style={{ fontSize: 17 }}>{item.icon}</span>
          <div className="nav-tooltip">{item.label}</div>
        </div>
      ))}

      <div className="sidebar-bottom">
        <div
          className="nav-item"
          onClick={() => { logout(); navigate('/'); }}
          title="Logout"
        >
          <span style={{ fontSize: 17 }}>🚪</span>
          <div className="nav-tooltip">Logout</div>
        </div>
        <div className="online-dot" />
      </div>
    </div>
  );
}
