'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, getSession } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Verificar sesión solo una vez al montar
    const session = getSession();
    if (session) {
      router.replace('/');
    }
  }, [mounted, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success && result.user) {
      window.location.href = '/';
    } else {
      setError(result.error || 'Error de autenticación');
      setLoading(false);
    }
  };

  // Mostrar nada mientras verifica sesión
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-[#E5E3DE]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1C1C1C] mb-2">Sam&apos;s Pets</h1>
          <p className="text-[#6B6B6B]">Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#1C1C1C] mb-2">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-[#E5E3DE] rounded-lg focus:ring-2 focus:ring-[#4A7C59] focus:border-transparent transition bg-white text-[#1C1C1C]"
              placeholder="Ingresa tu usuario"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1C1C1C] mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#E5E3DE] rounded-lg focus:ring-2 focus:ring-[#4A7C59] focus:border-transparent transition bg-white text-[#1C1C1C]"
              placeholder="Ingresa tu contraseña"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A7C59] hover:bg-[#3D6A4B] text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
