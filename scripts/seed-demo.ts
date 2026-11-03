/**
 * Demo seed: turns test-user-001 into a user who has practiced for ~30 days.
 *
 * Result:
 *   - ~60% of Hot 100 solved, uneven topic mastery (DP/Trees weaker)
 *   - 12-day streak, 30 days of DailyPush history, 2/5 done today
 *   - a few problems due for review today so the scheduler has work to do
 *
 * Idempotent: re-running resets the demo user's progress to this snapshot.
 * Run: npx tsx scripts/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_ID = 'test-user-001';

const DAY_MS = 86_400_000;

function localDayStart(offsetDays = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) +
      offsetDays * DAY_MS,
  );
}

/** Target completion ratio per topic — deliberately uneven for a realistic heatmap. */
const TOPIC_RATIOS: Record<string, number> = {
  'Arrays & Hashing': 0.85,
  'Two Pointers': 0.8,
  'Sliding Window': 0.7,
  'Binary Search': 0.7,
  'Stack & Queue': 0.6,
  'Linked List': 0.55,
  'Trees & Graphs': 0.45,
  'Dynamic Programming': 0.3,
  Backtracking: 0.4,
  Greedy: 0.55,
  Intervals: 0.6,
  'Math & Bit Manipulation': 0.35,
};

async function main() {
  const plan = await prisma.plan.findFirst({ where: { name: 'Hot 100' } });
  if (!plan) throw new Error('Hot 100 plan missing — run npm run db:seed first');

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: { planId: plan.id, dailyQuota: 5 },
    create: {
      id: USER_ID,
      wechatOpenId: `test-${USER_ID}`,
      wechatNickname: '林同学',
      planId: plan.id,
      dailyQuota: 5,
    },
  });

  const planProblems = await prisma.planProblem.findMany({
    where: { planId: plan.id },
    orderBy: { order: 'asc' },
    select: { problemId: true, problem: { select: { topic: true } } },
  });
  if (planProblems.length === 0) throw new Error('Plan has no problems');

  const byTopic = new Map<string, number[]>();
  for (const pp of planProblems) {
    const topic = pp.problem.topic;
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic)!.push(pp.problemId);
  }

  const solvedIds: number[] = [];
  for (const [topic, ids] of byTopic) {
    const ratio = TOPIC_RATIOS[topic] ?? 0.5;
    solvedIds.push(...ids.slice(0, Math.round(ids.length * ratio)));
  }

  const today = localDayStart(0);
  const allIds = planProblems.map((pp) => pp.problemId);

  // Reset every plan problem, then apply solved state.
  await prisma.userProblem.updateMany({
    where: { userId: USER_ID, problemId: { in: allIds } },
    data: {
      status: 'unsolved',
      mastery: 0,
      nextReviewAt: null,
      lastReviewedAt: null,
      reviewCount: 0,
    },
  });

  const solvedSet = new Set(solvedIds);
  for (let i = 0; i < allIds.length; i++) {
    const problemId = allIds[i]!;
    if (!solvedSet.has(problemId)) continue;

    // First 6 solved problems are due today → they feed the review queue.
    const dueOffset =
      i < 6 ? 0 : i % 11 === 0 ? -5 : 3 + (i % 25);

    await prisma.userProblem.update({
      where: { userId_problemId: { userId: USER_ID, problemId } },
      data: {
        status: 'solved',
        mastery: 2 + (i % 3),
        reviewCount: 1 + (i % 4),
        lastReviewedAt: new Date(today.getTime() - (1 + (i % 14)) * DAY_MS),
        nextReviewAt: new Date(today.getTime() + dueOffset * DAY_MS),
      },
    });
  }

  // Rebuild daily push history.
  await prisma.dailyPush.deleteMany({ where: { userId: USER_ID } });

  const unsolvedIds = allIds.filter((id) => !solvedSet.has(id));
  const rotate = (arr: number[], start: number, n: number) =>
    Array.from({ length: n }, (_, k) => arr[(start + k) % arr.length]!);

  for (let i = 29; i >= 0; i--) {
    const date = localDayStart(-i);
    const problemIds =
      i === 0
        ? [...rotate(solvedIds, 0, 2), ...rotate(unsolvedIds, 0, 3)]
        : rotate(solvedIds, i * 3, 5);

    const count =
      i === 0 ? 2 : i < 12 ? 2 + (i % 3) : i === 12 ? 0 : i % 4 === 0 ? 3 : i % 5 === 0 ? 2 : 0;

    const completedIds = problemIds.slice(0, Math.min(count, problemIds.length));
    await prisma.dailyPush.create({
      data: {
        userId: USER_ID,
        date,
        problemIds,
        completedIds,
        ratedIds: completedIds,
        isComplete: completedIds.length === problemIds.length,
      },
    });
  }

  const total = await prisma.userProblem.count({ where: { userId: USER_ID } });
  const solved = await prisma.userProblem.count({
    where: { userId: USER_ID, status: 'solved' },
  });
  console.log(
    `Demo ready: ${solved}/${total} solved (${Math.round((solved / total) * 100)}%), 12-day streak`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
