import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен быть не менее 6 символов' },
        { status: 400 }
      );
    }

    const user = await createUser(email, password);
    const token = createSessionToken(user);
    
    const response = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email } },
      { status: 201 }
    );
    
    response.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    
    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка при регистрации' },
      { status: 500 }
    );
  }
}