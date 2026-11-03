// ── Test JWT Bypass Utility ─────────────────────────────────────────────
// Creates NextAuth-compatible JWT tokens for E2E test users.
// Uses next-auth/jwt encode() to guarantee token format compatibility.
//
// IMPORTANT: This module must NEVER be imported in production code paths.
// The only consumer is app/api/auth/test-bypass/route.ts which guards on NODE_ENV.

import { encode } from 'next-auth/jwt';

export interface TestTokenUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Signs a test JWT token that matches the next-auth session format.
 *
 * Uses `next-auth/jwt` encode() with the same NEXTAUTH_SECRET so the token
 * is accepted by getServerSession() and the middleware JWT check.
 *
 * Token payload shape mirrors what the jwt callback in authOptions produces:
 *   { id, openid, sub, name, email, iat, exp }
 *
 * @param user - The user identity to embed in the token
 * @returns A signed JWT string (HS256, 24h expiry)
 */
export async function signTestToken(user: TestTokenUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'NEXTAUTH_SECRET environment variable is required for test token signing',
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return await encode({
    secret,
    maxAge: 24 * 60 * 60, // 24 hours
    token: {
      id: user.id,
      openid: `test-${user.id}`,
      sub: user.id,
      name: user.name,
      email: user.email,
      iat: now,
      exp: now + 86_400,
    },
  });
}
