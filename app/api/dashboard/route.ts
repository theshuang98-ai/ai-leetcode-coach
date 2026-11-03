// ── GET /api/dashboard ──────────────────────────────────────
// Returns multidimensional user progress data for the AI LeetCode Coach dashboard.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';
import { addLocalDays, localDayStart } from '@/lib/date';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // ── 1. totalProgress ──────────────────────────────────
    // Count all UserProblem records + those with status='solved'
    const userProblems = await prisma.userProblem.findMany({
      where: { userId },
      select: {
        status: true,
        mastery: true,
        problem: {
          select: { topic: true },
        },
      },
    });

    const total = userProblems.length;
    const solved = userProblems.filter((up) => up.status === 'solved').length;
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

    // ── 2. topicHeatmap ───────────────────────────────────
    // Group by Problem.topic; solved = mastery >= 2; avgMastery = avg of non-null masteries
    const topicMap = new Map<
      string,
      { solved: number; total: number; masteries: number[] }
    >();
    for (const up of userProblems) {
      const topic = up.problem.topic;
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { solved: 0, total: 0, masteries: [] });
      }
      const entry = topicMap.get(topic)!;
      entry.total += 1;
      if (up.mastery !== null && up.mastery >= 2) {
        entry.solved += 1;
      }
      if (up.mastery !== null) {
        entry.masteries.push(up.mastery);
      }
    }

    const topicHeatmap: Record<
      string,
      { solved: number; total: number; avgMastery: number }
    > = {};
    for (const [topic, data] of topicMap.entries()) {
      const avgMastery =
        data.masteries.length > 0
          ? Math.round(
              (data.masteries.reduce((a, b) => a + b, 0) /
                data.masteries.length) *
                100,
            ) / 100
          : 0;
      topicHeatmap[topic] = {
        solved: data.solved,
        total: data.total,
        avgMastery,
      };
    }

    // ── 3. calendar (last 30 days) ───────────────────────
    const today = localDayStart();
    const thirtyDaysAgo = addLocalDays(today, -29);

    const dailyPushes = await prisma.dailyPush.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
      select: {
        date: true,
        completedIds: true,
      },
      orderBy: { date: 'asc' },
    });

    // Index pushes by date string for fast lookup
    const pushMap = new Map<string, number>();
    for (const push of dailyPushes) {
      const dateStr = push.date.toISOString().split('T')[0]!;
      pushMap.set(dateStr, push.completedIds.length);
    }

    // Fill all 30 days (including today), zero for days with no push
    const calendar: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addLocalDays(today, -i);
      const dateStr = d.toISOString().split('T')[0]!;
      calendar.push({
        date: dateStr,
        count: pushMap.get(dateStr) ?? 0,
      });
    }

    // ── 4. streak ─────────────────────────────────────────
    // Consecutive days counting backwards from today with count > 0
    let streak = 0;
    for (let i = calendar.length - 1; i >= 0; i--) {
      const entry = calendar[i]!;
      if (entry.count > 0) {
        streak++;
      } else {
        break;
      }
    }

    // ── 5. estimatedCompletion ────────────────────────────
    // Average daily completions over the last 30 days
    const totalCompleted = dailyPushes.reduce(
      (sum, push) => sum + push.completedIds.length,
      0,
    );
    const daysWithActivity = dailyPushes.filter(
      (push) => push.completedIds.length > 0,
    ).length;
    const avgDailyRate =
      daysWithActivity > 0 ? totalCompleted / daysWithActivity : 0;

    const remaining = total - solved;
    const daysRemaining =
      avgDailyRate > 0 ? Math.ceil(remaining / avgDailyRate) : 0;

    const estimatedDate = new Date(today);
    estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);
    const estimatedDateStr = estimatedDate.toISOString().split('T')[0]!;

    // ── Response ──────────────────────────────────────────
    return NextResponse.json({
      totalProgress: {
        solved,
        total,
        percent,
      },
      topicHeatmap,
      calendar,
      streak,
      estimatedCompletion: {
        daysRemaining,
        date: estimatedDateStr,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
