import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    
    // TEMPORARY: Disable profile redirect entirely
    const DISABLE_PROFILE_REDIRECT = process.env.DISABLE_PROFILE_REDIRECT === 'true';
    
    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Middleware check:', {
        path: pathname,
        hasUsername: !!token?.username,
        username: token?.username,
        email: token?.email,
        redirectDisabled: DISABLE_PROFILE_REDIRECT
      });
    }
    
    // Define route types
    const isAdminRoute = pathname.startsWith('/admin');
    const isSettingsRoute = pathname.startsWith('/settings');
    const isProfileSetupRoute = pathname === '/profile/setup';
    const isAuthRoute = pathname.startsWith('/auth');
    const isApiRoute = pathname.startsWith('/api');
    const isPublicAsset = pathname.startsWith('/_next') || pathname.includes('.');
    
    // Allow access to critical routes without username check
    if (isSettingsRoute || isProfileSetupRoute || isAuthRoute || isApiRoute || isPublicAsset) {
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

    // Username check - only redirect if user truly has no username
    // Multiple safety checks to prevent redirect loops
    const skipRedirect = req.nextUrl.searchParams.get('skip_profile_redirect') === 'true';
    const fromParam = req.nextUrl.searchParams.get('from');
    const isProfilePath = pathname.includes('/profile');
    
    // Emergency stops to prevent loops
    if (fromParam?.includes('profile')) {
      console.log('Emergency stop: Preventing redirect loop from profile page');
      return NextResponse.next();
    }
    
    // Only redirect if ALL conditions are met
    if (!token?.username && 
        pathname !== '/profile/setup' && 
        !isProfilePath &&
        !skipRedirect &&
        !DISABLE_PROFILE_REDIRECT) {
      
      // Log the redirect for debugging
      console.log('Redirecting to profile setup:', {
        hasUsername: !!token?.username,
        pathname,
        isProfilePath,
        skipRedirect
      });
      
      const url = new URL('/profile/setup', req.url);
      url.searchParams.set('from', pathname);
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
    '/labels/:path*',
    '/settings/:path*'
  ],
};