'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User } from '@/types/auth';

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  user: User | null;
  onLogout: () => void;
}

const MENU_ITEMS = [
  { id: 'inicio', name: 'Inicio', icon: '🏠' },
  { id: 'agenda', name: 'Agenda', icon: '📅' },
  { id: 'mascotas', name: 'Mascotas', icon: '🐕' },
  { id: 'clientes', name: 'Clientes', icon: '👥' },
  { id: 'servicios', name: 'Servicios', icon: '✂️' },
  { id: 'reportes', name: 'Reportes', icon: '📊' },
  { id: 'configuracion', name: 'Configuración', icon: '⚙️' },
];

export default function Sidebar({ currentSection, onSectionChange, user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-slate-800 text-white flex flex-col transition-all duration-300 z-50
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Logo */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-center">
        {collapsed ? (
          <span className="text-2xl">🐾</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-bold text-lg">Sam&apos;s Pets</span>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-slate-600 transition-colors"
      >
        {collapsed ? '→' : '←'}
      </button>

      {/* Menu */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onSectionChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors
                  ${currentSection === item.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span className="font-medium">{item.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info & logout */}
      <div className="p-4 border-t border-slate-700">
        {collapsed ? (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            🚪
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              <p className="font-medium text-white">{user?.displayName}</p>
              <p className="text-slate-400 text-xs">
                {user?.role === 'ADMINISTRADOR_GENERAL' ? 'Administrador' : 'Personal'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
