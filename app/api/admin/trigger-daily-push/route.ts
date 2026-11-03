// ── POST /api/admin/trigger-daily-push ────────────────────────────────
// Admin-only endpoint to manually trigger daily push generation for a user.
// Useful for testing and manual intervention.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { generateDailyPush } from '@/lib/scheduler';

// Simple admin check — in production, use a proper admin role system.
// For now, we check for a hardcoded admin email or an admin secret header.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isAdmin(session: { user?: { email?: string | null } } | null): boolean {
  if (!session?.user?.email) return false;
  return ADMIN_EMAIL ? session.user.email === ADMIN_EMAIL : true;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check: either the user is admin OR they pass X-Admin-Secret header
    const adminSecret = req.headers.get('X-Admin-Secret');
    const isAdminUser = isAdmin(session);

    if (!isAdminUser && adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse target user ID from body (defaults to the requesting user)
    const body = await req.json().catch(() => ({}));
    const targetUserId = (body.userId as string | undefined) ?? session.user.id;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const dailyPush = await generateDailyPush(targetUserId);

    return NextResponse.json({
      success: true,
      dailyPush: {
        id: dailyPush.id,
        userId: dailyPush.userId,
        date: dailyPush.date,
        problemCount: dailyPush.problemIds.length,
        isComplete: dailyPush.isComplete,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/trigger-daily-push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
