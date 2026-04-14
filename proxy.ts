import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const token = request.cookies.get('session')?.value;
  
  let isAuthenticated = false;
  if (token) {
    const payload = verifySessionToken(token);
    isAuthenticated = !!payload;
  }
  
  const isPublicPath = pathname === '/login' || pathname === '/register';
  const isApiAuthPath = pathname.startsWith('/api/auth');
  
  if (isApiAuthPath) {
    return NextResponse.next();
  }
  
  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  if (!isAuthenticated && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};