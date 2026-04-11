import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="h-16 bg-black border-b border-red-600 flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-8">
        <Link to="/home" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
            <ShieldAlert size={20} className="text-white" />
          </div>
          <span className="text-lg font-black italic tracking-tighter text-white uppercase">COMMAND</span>
        </Link>

        <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-gray-400">
          <Link to="/home" className="hover:text-red-500 transition-colors">Home</Link>
          <Link to="/dashboard" className="hover:text-red-500 transition-colors">Dashboard</Link>
          <Link to="/help" className="hover:text-red-500 transition-colors">Help</Link>
          <Link to="/safety" className="hover:text-red-500 transition-colors">Safety Guide</Link>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-xs font-black text-white uppercase">{user?.name || 'GUEST'}</div>
          <div className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">{user?.role === 'admin' ? 'RESPONDER' : 'CITIZEN'}</div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded bg-white/5 border border-white/10 hover:bg-red-600 group transition-all"
        >
          <User size={20} className="text-gray-400 group-hover:text-white" />
        </button>
      </div>
    </nav>
  );
}
