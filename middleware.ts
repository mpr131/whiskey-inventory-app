import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    
    // Define route types
    const isAdminRoute = pathname.startsWith('/admin');
    const isSettingsRoute = pathname.startsWith('/settings');
    const isAuthRoute = pathname.startsWith('/auth');
    const isApiRoute = pathname.startsWith('/api');
    const isPublicAsset = pathname.startsWith('/_next') || pathname.includes('.');
    
    // Allow access to critical routes without username check
    if (isSettingsRoute || isAuthRoute || isApiRoute || isPublicAsset) {
      // Only check admin access for admin routes
      if (isAdminRoute && !token?.isAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      return NextResponse.next();
    }

    // Check admin access for admin routes
    if (isAdminRoute && !token?.isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Username check - only for non-critical routes
    // This prevents redirect loops while still enforcing username setup
    if (!token?.username && pathname !== '/settings/profile') {
      const url = new URL('/settings/profile', req.url);
      url.searchParams.set('setup', 'true');
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/admin/:path*', 
    '/bottles/:path*', 
    '/locations/:path*',
    '/pour/:path*',
    '/feed/:path*',
    '/friends/:path*',
    '/profile/:path*',
    '/analytics/:path*',
    '/notifications/:path*',
    '/labels/:path*'
  ],
};