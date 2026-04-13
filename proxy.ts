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
  
  // Если пользователь авторизован и пытается зайти на login/register
  if (isAuthenticated && isPublicPath) {
    console.log('[Proxy] Auth user on public path -> redirect to /');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Если пользователь НЕ авторизован и пытается зайти на защищённую страницу
  if (!isAuthenticated && !isPublicPath && pathname !== '/') {
    console.log('[Proxy] Unauth user on protected path -> redirect to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Если пользователь авторизован и на главной (/)
  if (isAuthenticated && pathname === '/') {
    console.log('[Proxy] Auth user on / -> allow');
    return NextResponse.next();
  }
  
  // Если пользователь не авторизован на главной
  if (!isAuthenticated && pathname === '/') {
    console.log('[Proxy] Unauth user on / -> redirect to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};