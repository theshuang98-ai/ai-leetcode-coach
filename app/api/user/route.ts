import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { validateApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user
 *
 * Returns the current authenticated user's profile.
 * Supports two authentication methods:
 *   1. JWT session cookie (web — validated via getServerSession)
 *   2. Bearer token (Chrome extension — validated via API Key lookup)
 *
 * Response: { user: { id, wechatOpenId, wechatNickname, createdAt } }
 * Errors: 401 Unauthorized, 500 Internal Server Error
 */
export async function GET(req: NextRequest) {
  try {
    // Method 1: JWT session (web browser)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          wechatOpenId: true,
          wechatNickname: true,
          createdAt: true,
        },
      });
      if (user) {
        return NextResponse.json({ user });
      }
    }

    // Method 2: Bearer token (Chrome extension)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const userId = await validateApiKey(apiKey);
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            wechatOpenId: true,
            wechatNickname: true,
            createdAt: true,
          },
        });
        if (user) {
          return NextResponse.json({ user });
        }
      }
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    console.error('GET /api/user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
