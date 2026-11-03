// ── POST /api/user/sync ──────────────────────────────────────
// Sync LeetCode CN problem-solving history into UserProblem records.
//
// Accepts:  { leetcodeProblemIds: number[] }
// Returns:  { syncedCount, skippedCount, totalMatched }
//
// Auth: JWT session cookie (web) OR Bearer token (extension)
// Idempotent: running twice does not duplicate or corrupt data.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { validateApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // ── Auth: JWT session (web) or API key (extension) ─────
    const session = await getServerSession(authOptions);
    let userId: string | null = session?.user?.id ?? null;

    if (!userId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        userId = await validateApiKey(authHeader.slice(7));
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ─────────────────────────────────────────
    const body = await req.json();
    const leetcodeProblemIds: number[] = body.leetcodeProblemIds;

    if (!Array.isArray(leetcodeProblemIds) || leetcodeProblemIds.length === 0) {
      return NextResponse.json(
        { error: 'leetcodeProblemIds must be a non-empty array of numbers' },
        { status: 400 },
      );
    }

    // ── Look up problems by leetcodeId in our problem bank ──
    const problems = await prisma.problem.findMany({
      where: { leetcodeId: { in: leetcodeProblemIds } },
      select: { id: true, leetcodeId: true },
    });

    const totalMatched = problems.length;
    const skippedCount = leetcodeProblemIds.length - totalMatched;

    // ── Upsert UserProblem records ─────────────────────────
    if (totalMatched > 0) {
      const upsertOps = problems.map((problem) =>
        prisma.userProblem.upsert({
          where: {
            userId_problemId: { userId, problemId: problem.id },
          },
          create: {
            userId,
            problemId: problem.id,
            status: 'solved',
            mastery: 2,
            reviewCount: 0,
          },
          update: {
            status: 'solved',
            // Do not overwrite mastery on re-sync — preserve user's self-rating
          },
        }),
      );

      await prisma.$transaction(upsertOps);
    }

    return NextResponse.json({
      syncedCount: totalMatched,
      skippedCount,
      totalMatched,
    });
  } catch (error) {
    console.error('POST /api/user/sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
