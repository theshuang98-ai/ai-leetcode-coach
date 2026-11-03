import { withAuth } from 'next-auth/middleware';

/**
 * NextAuth v4 middleware for route protection.
 *
 * Protected routes:
 *   Web pages: /dashboard, /daily, /subscribe, /onboarding
 *   API: /api/protected/*, /api/user
 *
 * Public routes:
 *   Web: /, /login
 *   API: /api/auth/*, /api/health, /api/plans
 *
 * Auth methods (checked in order):
 *   1. JWT cookie (web session — validated by NextAuth)
 *   2. Bearer token in Authorization header (API Key — validated by route handler)
 *
 * For API routes with Bearer tokens, the middleware lets the request through
 * and the route handler performs the actual API Key validation.
 *
 * Unauthorized API requests → 401 JSON
 * Unauthorized page requests → redirect to /login
 */
export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      const path = req.nextUrl.pathname;

      // ── Dev mode: skip auth for all routes ─────────────
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) return true;

      // ── Public routes (no auth required) ──────────────
      if (
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/api/auth/') ||
        path === '/api/health' ||
        path === '/api/plans'
      ) {
        return true;
      }

      // ── JWT session (web) ─────────────────────────────
      if (token) return true;

      // ── Bearer token (API Key for Chrome extension) ───
      // Middleware allows through; route handler validates
      if (path.startsWith('/api/')) {
        const authHeader = req.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
          return true;
        }
      }

      return false;
    },
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/daily/:path*',
    '/subscribe/:path*',
    '/onboarding/:path*',
    '/api/protected/:path*',
    '/api/user',
  ],
};
