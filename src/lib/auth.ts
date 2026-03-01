import { User, UserRole } from '@/types/auth';

const STORAGE_KEY = 'sams_pets_auth';

const USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'Sam1993!!',
    user: {
      username: 'admin',
      role: 'ADMINISTRADOR_GENERAL',
      displayName: 'Administrador General'
    }
  },
  staff: {
    password: 'SamsPets26!',
    user: {
      username: 'staff',
      role: 'ADMINISTRATIVO',
      displayName: 'Personal Administrativo'
    }
  }
};

export function login(username: string, password: string): { success: boolean; user?: User; error?: string } {
  const credentials = USERS[username.toLowerCase()];

  if (!credentials) {
    return { success: false, error: 'Usuario no encontrado' };
  }

  if (credentials.password !== password) {
    return { success: false, error: 'Contraseña incorrecta' };
  }

  // Guardar sesión en localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials.user));
  }

  return { success: true, user: credentials.user };
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getSession(): User | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const user = JSON.parse(stored) as User;
    return user;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const { PERMISSIONS } = require('@/types/auth');
  return PERMISSIONS[role].includes(permission as any);
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMINISTRADOR_GENERAL';
}
