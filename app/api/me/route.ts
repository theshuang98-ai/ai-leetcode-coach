// ── GET /api/me ──────────────────────────────────────────────────
// Returns the current user profile for Chrome extension API Key auth.
//
// Auth: Bearer token (API Key) — primary use case is extension popup
//        which calls this to validate the API key and get user info.
//
// Response: { id, email, name }
// Errors: 401 Unauthorized, 404 User not found

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const userId = await validateApiKey(apiKey);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        wechatNickname: true,
        wechatOpenId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.wechatNickname ?? user.wechatOpenId ?? user.id,
      name: user.wechatNickname ?? 'User',
    });
  } catch (error) {
    console.error('GET /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
