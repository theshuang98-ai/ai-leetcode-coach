// ── GET /api/daily-push ────────────────────────────────────
// Returns today's daily push with full problem details for the authenticated user.
// If no push exists for today, generates one on the fly.
//
// MOCK MODE: when PostgreSQL is unavailable (dev without DB), returns
// 5 random problems from data/problems.json. No persistence.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { validateApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/prisma';
import { generateDailyPush } from '@/lib/scheduler';
import { localDayStart } from '@/lib/date';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Mock problem cache ──────────────────────────────────────────
interface MockProblem {
  id: number;
  title: string;
  titleCn: string;
  difficulty: string;
  difficultyScore: number;
  contestRating?: number;
  topic: string;
  slug: string;
}
let _mockProblemsCache: MockProblem[] | null = null;

function getMockProblems(): MockProblem[] {
  if (!_mockProblemsCache) {
    const raw = readFileSync(join(process.cwd(), 'data/problems.json'), 'utf-8');
    _mockProblemsCache = JSON.parse(raw) as MockProblem[];
  }
  return _mockProblemsCache;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function GET(req: NextRequest) {
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

    const today = localDayStart();

    let dailyPush: Awaited<ReturnType<typeof prisma.dailyPush.findUnique>>;
    try {
      // Try to find existing today's push
      dailyPush = await prisma.dailyPush.findUnique({
        where: { userId_date: { userId, date: today } },
      });

      // If push exists but is empty (edge case: generated before plan/quota was set),
      // delete it and regenerate
      if (dailyPush && dailyPush.problemIds.length === 0) {
        await prisma.dailyPush.delete({
          where: { id: dailyPush.id },
        });
        dailyPush = null;
      }

      if (!dailyPush) {
        dailyPush = await generateDailyPush(userId);
      }

      // Fetch full problem details for all problem IDs in the push
      const problems = await prisma.problem.findMany({
        where: { id: { in: dailyPush.problemIds } },
        select: {
          id: true,
          leetcodeId: true,
          title: true,
          titleCn: true,
          slug: true,
          difficulty: true,
          difficultyScore: true,
          contestRating: true,
          topic: true,
        },
      });

      // Fetch user problem metadata for these problems
      const userProblems = await prisma.userProblem.findMany({
        where: { userId, problemId: { in: dailyPush.problemIds } },
        select: {
          problemId: true,
          status: true,
          mastery: true,
          reviewCount: true,
          nextReviewAt: true,
        },
      });

      const userProblemByProblemId = new Map(
        userProblems.map((up) => [up.problemId, up]),
      );

      const problemsWithMeta = problems.map((problem) => ({
        ...problem,
        userStatus: userProblemByProblemId.get(problem.id)?.status ?? null,
        userMastery: userProblemByProblemId.get(problem.id)?.mastery ?? null,
        reviewCount: userProblemByProblemId.get(problem.id)?.reviewCount ?? 0,
        nextReviewAt: userProblemByProblemId.get(problem.id)?.nextReviewAt ?? null,
        isCompleted: dailyPush!.completedIds.includes(problem.id),
        isRated: dailyPush!.ratedIds.includes(problem.id),
      }));

      return NextResponse.json({
        id: dailyPush.id,
        date: dailyPush.date,
        isComplete: dailyPush.isComplete,
        problemCount: dailyPush.problemIds.length,
        completedCount: dailyPush.completedIds.length,
        problems: problemsWithMeta,
      });
    } catch {
      // ── MOCK MODE: Database unavailable ─────────────────────────
      const allProblems = getMockProblems();
      const picked = pickRandom(allProblems, 5);
      const todayStr = today.toISOString().split('T')[0];

      const problems = picked.map((p) => ({
        id: p.id,
        leetcodeId: p.id,
        title: p.title,
        titleCn: p.titleCn,
        slug: p.slug,
        difficulty: p.difficulty,
        difficultyScore: p.difficultyScore,
        contestRating: p.contestRating ?? null,
        topic: p.topic,
        userStatus: null,
        userMastery: null,
        reviewCount: 0,
        nextReviewAt: null,
        isCompleted: false,
        isRated: false,
      }));

      return NextResponse.json({
        id: `mock-${todayStr}`,
        date: todayStr,
        isComplete: false,
        problemCount: problems.length,
        completedCount: 0,
        problems,
        _mock: true,
        _warning: 'Database unavailable — running in mock mode. Progress will not persist.',
      });
    }
  } catch (error) {
    console.error('GET /api/daily-push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
