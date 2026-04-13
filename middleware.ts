import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Получаем токен из cookies
  const token = request.cookies.get('session')?.value;
  
  // Определяем, авторизован ли пользователь
  const isAuthenticated = !!token;
  
  // Определяем, является ли путь публичным
  const isPublicPath = pathname === '/login' || pathname === '/register';
  const isRootPath = pathname === '/';
  const isApiAuthPath = pathname.startsWith('/api/auth');
  
  console.log(`[Middleware] Path: ${pathname}, Auth: ${isAuthenticated}`);
  
  // Для API авторизации всегда пропускаем
  if (isApiAuthPath) {
    return NextResponse.next();
  }
  
  // Если пользователь авторизован и пытается зайти на /, /login или /register
  if (isAuthenticated && (isRootPath || isPublicPath)) {
    console.log('[Middleware] Redirecting to /dashboard');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Если пользователь НЕ авторизован и пытается зайти на защищённую страницу
  if (!isAuthenticated && !isPublicPath && !isRootPath) {
    console.log('[Middleware] Redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Во всех остальных случаях пропускаем
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};