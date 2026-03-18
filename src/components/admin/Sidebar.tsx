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
  { id: 'recordatorios', name: 'Recordatorios', icon: '🔔' },
  { id: 'reportes', name: 'Reportes', icon: '📊' },
  { id: 'configuracion', name: 'Configuración', icon: '⚙️' },
];

function getInitials(name: string | undefined): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar({ currentSection, onSectionChange, user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50
        ${collapsed ? 'w-16' : 'w-60'}
        bg-white text-[#4A4A4A] border-r border-[#E8E4DC]
      `}
    >
      {/* Logo */}
      <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-center">
        {collapsed ? (
          <span className="text-2xl" style={{ color: '#4A7C59' }}>🐾</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-bold text-lg" style={{ color: '#4A7C59' }}>Sam&apos;s Pets</span>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-white border border-[#E8E4DC] rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-[#F5F3EE] transition-colors shadow-sm"
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
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative
                  ${currentSection === item.id
                    ? 'bg-[#EEF4F0] text-[#4A7C59] font-medium'
                    : 'text-[#4A4A4A] hover:bg-[#F5F3EE] hover:text-[#4A4A4A]'
                  }
                `}
              >
                {currentSection === item.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#4A7C59] rounded-r" />
                )}
                <span className="text-[18px]">{item.icon}</span>
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info & logout */}
      <div className="p-4 border-t border-[#E8E4DC]">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#4A7C59] flex items-center justify-center text-white text-xs font-medium">
              {getInitials(user?.displayName)}
            </div>
            <button
              onClick={onLogout}
              className="flex items-center justify-center py-2 text-[#C0392B] hover:underline transition-colors"
              title="Cerrar sesión"
            >
              🚪
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#4A7C59] flex items-center justify-center text-white text-sm font-medium">
                {getInitials(user?.displayName)}
              </div>
              <div className="text-sm">
                <p className="font-medium text-[#1C1C1C]">{user?.displayName}</p>
                <p className="text-[#6B6B6B] text-xs">
                  {user?.role === 'ADMINISTRADOR_GENERAL' ? 'Administrador' : 'Personal'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full py-2 px-3 rounded-lg text-sm text-[#C0392B] hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
