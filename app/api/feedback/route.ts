import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';

// ── Scheduling Formula ─────────────────────────────────────────────

function computeNextReview(
  mastery: number,
  contestRating: number | null | undefined,
  nthReview: number,
  difficultyScore?: number,
): { days: number; date: Date } {
  // Use contestRating directly, fallback to estimated rating from difficultyScore
  const rating = contestRating ?? (difficultyScore ? 1200 + (difficultyScore - 1) * 75 : 1500);

  let initial: number;
  if (rating <= 1300) initial = 7;
  else if (rating <= 1500) initial = 5;
  else if (rating <= 1700) initial = 3;
  else initial = 2;

  const stability = mastery >= 3 ? 2.5 : mastery >= 2 ? 1.8 : 1.2;

  let days = initial * Math.pow(stability, Math.max(nthReview - 1, 0));
  const diffMult = 1.0 + rating / 2000;
  days = days / diffMult;
  days = Math.min(days, 90);
  days = Math.round(days * 100) / 100;

  return { days, date: new Date(Date.now() + days * 86400000) };
}

// ── POST /api/feedback ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth required
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    let body: { problemId?: unknown; mastery?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { problemId, mastery } = body;

    // 3. Validate problemId
    if (typeof problemId !== 'number' || !Number.isInteger(problemId)) {
      return NextResponse.json(
        { error: 'problemId must be an integer' },
        { status: 400 },
      );
    }

    // 4. Validate mastery (must be 1, 2, or 3)
    if (![1, 2, 3].includes(mastery as number)) {
      return NextResponse.json(
        { error: 'mastery must be 1, 2, or 3' },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    // 5. Fetch UserProblem + Problem contestRating
    const userProblem = await prisma.userProblem.findUnique({
      where: { userId_problemId: { userId, problemId } },
      include: {
        problem: {
          select: { contestRating: true, difficultyScore: true, title: true },
        },
      },
    });

    if (!userProblem) {
      return NextResponse.json(
        { error: 'Problem not found for this user' },
        { status: 404 },
      );
    }

    // 6. Status must be "solved"
    if (userProblem.status !== 'solved') {
      return NextResponse.json(
        { error: 'Only solved problems can be rated' },
        { status: 400 },
      );
    }

    // 7. 24h duplicate check
    if (userProblem.lastReviewedAt) {
      const hoursSinceLastRating =
        (Date.now() - userProblem.lastReviewedAt.getTime()) / 3600000;
      if (hoursSinceLastRating < 24) {
        return NextResponse.json(
          { error: '24小时内已评价' },
          { status: 400 },
        );
      }
    }

    // 8. Compute next review schedule
    const newReviewCount = userProblem.reviewCount + 1;
    const { days, date: nextReviewDate } = computeNextReview(
      mastery as number,
      userProblem.problem.contestRating,
      newReviewCount,
      userProblem.problem.difficultyScore,
    );

    // 9. Update UserProblem
    await prisma.userProblem.update({
      where: { userId_problemId: { userId, problemId } },
      data: {
        mastery: mastery as number,
        reviewCount: newReviewCount,
        lastReviewedAt: new Date(),
        nextReviewAt: nextReviewDate,
      },
    });

    // 10. Build Chinese message
    const message =
      days < 1
        ? `下次复习：今天`
        : days < 2
          ? `下次复习：明天`
          : `下次复习：${Math.round(days)} 天后`;

    return NextResponse.json({
      success: true,
      nextReview: nextReviewDate.toISOString(),
      intervalDays: days,
      message,
    });
  } catch (error) {
    console.error('POST /api/feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
