import { User, UserRole } from '@/types/auth';

const STORAGE_KEY = 'sams_pets_auth';

export async function login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.success && data.user) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      }
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error || 'Error de autenticación' };
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
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
