// ── POST /api/auth/test-bypass ─────────────────────────────────────────
// Creates a valid NextAuth JWT for a given user, bypassing WeChat OAuth.
//
// SECURITY: ONLY available when NODE_ENV is 'development' or 'staging'.
// Returns 404 in production. Never exposed to real users.
//
// Request:  { userId: string, createIfMissing?: boolean, name?: string }
// Response: { token: string, user: { id, email, name } }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signTestToken } from '@/lib/auth/test-bypass';

export async function POST(req: NextRequest) {
  // ── Guard: only non-production environments ──────────────────────
  // Also check VERCEL_ENV for Vercel-deployed preview/staging branches.
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  ) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, createIfMissing, name } = body as {
      userId?: string;
      createIfMissing?: boolean;
      name?: string;
    };

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 },
      );
    }

    // ── Attempt DB lookup (may fail if no PostgreSQL) ──────────
    let dbOk = true;
    let user: { id: string; wechatNickname: string | null; wechatOpenId: string | null } | null = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, wechatNickname: true, wechatOpenId: true },
      });
    } catch {
      dbOk = false;
    }

    if (dbOk && !user) {
      if (createIfMissing) {
        try {
          // Create a fresh test user with free subscription
          user = await prisma.user.create({
            data: {
              id: userId,
              wechatOpenId: `test-${userId}`,
              wechatNickname: name ?? 'E2E Test User',
              dailyQuota: 5,
              subscriptionStatus: 'free',
            },
            select: { id: true, wechatNickname: true, wechatOpenId: true },
          });
        } catch {
          dbOk = false;
        }
      } else if (!dbOk) {
        // DB is down, fall through to mock mode
      } else {
        return NextResponse.json(
          {
            error:
              'User not found. Set createIfMissing=true to auto-create a fresh test user.',
          },
          { status: 404 },
        );
      }
    }

    // ── Issue JWT ───────────────────────────────────────────────
    // MOCK MODE: when DB is unreachable (no PostgreSQL in dev), sign
    // a token directly with the provided userId — no persistence needed.
    const effectiveId = user?.id ?? userId;
    const displayName = user?.wechatNickname ?? name ?? 'Dev Test User';
    const email = `${effectiveId}@e2e-test.local`;

    const token = await signTestToken({
      id: effectiveId,
      email,
      name: displayName,
    });

    const responseBody: Record<string, unknown> = {
      token,
      user: {
        id: effectiveId,
        email,
        name: displayName,
      },
    };

    if (!dbOk) {
      (responseBody as Record<string, unknown>).mock = true;
      (responseBody as Record<string, unknown>).warning = 'Database unavailable — running in mock mode. Data will not persist.';
    }

    const response = NextResponse.json(responseBody);

    // Set next-auth session cookie so the client is immediately authenticated.
    // Cookie name differs between dev (no HTTPS) and production.
    const cookieName =
      process.env.NODE_ENV === 'development'
        ? 'next-auth.session-token'
        : '__Secure-next-auth.session-token';

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('POST /api/auth/test-bypass error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
