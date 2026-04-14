import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '../../../../lib/db';

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
    
    // Возвращаем успешный ответ без установки сессии
    return NextResponse.json(
      { success: true, message: 'Регистрация успешна! Теперь войдите.' },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка при регистрации' },
      { status: 500 }
    );
  }
}