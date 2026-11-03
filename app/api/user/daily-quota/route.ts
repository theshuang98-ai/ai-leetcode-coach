import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';

const MIN_QUOTA = 1;
const MAX_QUOTA = 10;

/**
 * PUT /api/user/daily-quota
 *
 * Updates the daily problem quota for the authenticated user.
 *
 * Request body: { dailyQuota: number (1-10) }
 * Response:     { success: true, dailyQuota: number }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { dailyQuota } = body as { dailyQuota?: number };

    // ── Validation ──────────────────────────────────────────────
    if (dailyQuota === undefined || dailyQuota === null) {
      return NextResponse.json(
        { error: 'dailyQuota is required' },
        { status: 400 },
      );
    }

    if (typeof dailyQuota !== 'number' || dailyQuota < MIN_QUOTA || dailyQuota > MAX_QUOTA) {
      return NextResponse.json(
        { error: `dailyQuota must be between ${MIN_QUOTA} and ${MAX_QUOTA}` },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { dailyQuota },
    });

    return NextResponse.json({ success: true, dailyQuota });
  } catch (error) {
    console.error('PUT /api/user/daily-quota error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/user/daily-quota
 *
 * Returns the daily problem quota for the authenticated user.
 *
 * Response: { dailyQuota: number }
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dailyQuota: true },
    });

    return NextResponse.json({ dailyQuota: user?.dailyQuota ?? 5 });
  } catch (error) {
    console.error('GET /api/user/daily-quota error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
