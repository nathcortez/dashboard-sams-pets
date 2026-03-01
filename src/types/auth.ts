export type UserRole = 'ADMINISTRADOR_GENERAL' | 'ADMINISTRATIVO';

export interface User {
  username: string;
  role: UserRole;
  displayName: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export const PERMISSIONS = {
  ADMINISTRADOR_GENERAL: [
    'calendar',
    'appointments',
    'clients',
    'reports',
    'management',
    'database'
  ],
  ADMINISTRATIVO: [
    'calendar',
    'appointments'
  ]
} as const;

export type Permission = typeof PERMISSIONS.ADMINISTRADOR_GENERAL[number];

export type PermissionList = readonly Permission[];
