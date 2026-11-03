// ── POST /api/daily-push/complete ─────────────────────────────────────
// Marks selected problems as completed for today's daily push.
// Updates UserProblem mastery/review stats and schedules next review.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { validateApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/prisma';
import { computeNextReview } from '@/lib/scheduler';
import { localDayStart } from '@/lib/date';

export async function POST(req: NextRequest) {
  let problemId: number | undefined;
  let mastery: number | undefined;
  let rating: number | undefined;

  try {
    const body = await req.json();
    problemId = body.problemId as number | undefined;
    mastery = body.mastery as number | undefined;
    rating = body.rating as number | undefined;

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

    if (!problemId) {
      return NextResponse.json(
        { error: 'problemId is required' },
        { status: 400 },
      );
    }

    const today = localDayStart();

    // Find today's DailyPush
    const dailyPush = await prisma.dailyPush.findUnique({
      where: {
        userId_date: { userId, date: today },
      },
    });

    if (!dailyPush) {
      return NextResponse.json(
        { error: 'No daily push found for today. Generate one first.' },
        { status: 404 },
      );
    }

    // Verify the problem is in today's push
    if (!dailyPush.problemIds.includes(problemId)) {
      return NextResponse.json(
        { error: 'Problem is not in today\'s daily push' },
        { status: 400 },
      );
    }

    // Update DailyPush: add to completedIds
    const newCompletedIds = dailyPush.completedIds.includes(problemId)
      ? dailyPush.completedIds
      : [...dailyPush.completedIds, problemId];

    const newRatedIds =
      rating !== undefined && !dailyPush.ratedIds.includes(problemId)
        ? [...dailyPush.ratedIds, problemId]
        : dailyPush.ratedIds;

    // Update UserProblem record
    const existingUserProblem = await prisma.userProblem.findUnique({
      where: {
        userId_problemId: { userId, problemId },
      },
    });

    if (existingUserProblem) {
      // Need contestRating for computeNextReview
      const problem = await prisma.problem.findUnique({
        where: { id: problemId },
        select: { contestRating: true, difficultyScore: true },
      });

      if (!problem) {
        return NextResponse.json(
          { error: 'Problem not found' },
          { status: 404 },
        );
      }

      const nextReviewAt = computeNextReview(
        mastery ?? existingUserProblem.mastery ?? 0,
        problem.contestRating,
        existingUserProblem.reviewCount + 1,
        problem.difficultyScore,
      );

      await prisma.$transaction([
        prisma.dailyPush.update({
          where: { id: dailyPush.id },
          data: {
            completedIds: newCompletedIds,
            ratedIds: newRatedIds,
            isComplete:
              newCompletedIds.length === dailyPush.problemIds.length,
          },
        }),
        prisma.userProblem.update({
          where: {
            userId_problemId: { userId, problemId },
          },
          data: {
            status:
              mastery !== undefined && mastery >= 2
                ? 'solved'
                : existingUserProblem.status,
            ...(mastery !== undefined ? { mastery } : {}),
            reviewCount: existingUserProblem.reviewCount + 1,
            lastReviewedAt: new Date(),
            nextReviewAt,
          },
        }),
      ]);
    } else {
      await prisma.dailyPush.update({
        where: { id: dailyPush.id },
        data: {
          completedIds: newCompletedIds,
          ratedIds: newRatedIds,
          isComplete:
            newCompletedIds.length === dailyPush.problemIds.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      completedIds: newCompletedIds,
      isComplete:
        newCompletedIds.length === dailyPush.problemIds.length,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    // MOCK MODE: if DB is unreachable, accept submission without persistence
    if (
      process.env.NODE_ENV === 'development' &&
      (err.code?.startsWith('P') || err.message?.includes('connect'))
    ) {
      return NextResponse.json({
        success: true,
        completedIds: [problemId],
        isComplete: false,
        _mock: true,
        _warning: 'Database unavailable — progress will not persist.',
      });
    }
    console.error('POST /api/daily-push/complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
