import { NextRequest, NextResponse } from 'next/server';

const USERS: Record<string, { password: string; role: string; displayName: string }> = {
  admin: {
    password: process.env.ADMIN_PASSWORD || '',
    role: 'ADMINISTRADOR_GENERAL',
    displayName: 'Administrador General',
  },
  staff: {
    password: process.env.STAFF_PASSWORD || '',
    role: 'ADMINISTRATIVO',
    displayName: 'Personal Administrativo',
  },
};

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const credentials = USERS[username?.toLowerCase()];

  if (!credentials) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
  }

  if (credentials.password !== password) {
    return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const user = {
    username: username.toLowerCase(),
    role: credentials.role,
    displayName: credentials.displayName,
  };

  return NextResponse.json({ success: true, user });
}
