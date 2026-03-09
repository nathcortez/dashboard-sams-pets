'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { User } from '@/types/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Verificar sesión al montar
    const session = getSession();
    setUser(session);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === '/login';

    if (!user && !isLoginPage) {
      router.push('/login');
    } else if (user && isLoginPage) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A7C59]"></div>
      </div>
    );
  }

  // Si no hay usuario y no estamos en login, no mostrar nada mientras redirige
  if (!user && pathname !== '/login') {
    return null;
  }

  return (
    <>
      {user && (
        <div className="hidden" id="current-user" data-user={JSON.stringify(user)}></div>
      )}
      {children}
    </>
  );
}

// Hook para acceder al usuario desde cualquier componente
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentar obtener del DOM primero (para el renderizado inicial)
    const userData = document.getElementById('current-user')?.getAttribute('data-user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser(getSession());
      }
    } else {
      setUser(getSession());
    }
    setLoading(false);
  }, []);

  return { user, loading };
}
