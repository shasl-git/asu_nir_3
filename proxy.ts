import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Получаем токен из cookies
  const token = request.cookies.get('session')?.value;
  
  // Определяем, авторизован ли пользователь
  let isAuthenticated = false;
  if (token) {
    const payload = verifySessionToken(token);
    isAuthenticated = !!payload;
  }
  
  // Публичные пути (доступны без авторизации)
  const isPublicPath = pathname === '/login' || pathname === '/register';
  const isApiAuthPath = pathname.startsWith('/api/auth');
  
  console.log(`[Proxy] Path: ${pathname}, Auth: ${isAuthenticated}`);
  
  // API авторизации всегда пропускаем
  if (isApiAuthPath) {
    return NextResponse.next();
  }
  
  // Если пользователь авторизован и пытается зайти на login или register
  if (isAuthenticated && isPublicPath) {
    console.log('[Proxy] Redirecting authenticated user from public page to /');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Если пользователь НЕ авторизован и пытается зайти на любую страницу, кроме login/register
  if (!isAuthenticated && !isPublicPath) {
    console.log('[Proxy] Redirecting unauthenticated user to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // ВСЕ ОСТАЛЬНЫЕ СЛУЧАИ - пропускаем (включая / для авторизованных пользователей)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};