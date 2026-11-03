// ── Daily Push Engine ──────────────────────────────────────────────────
// Problem selection with SM-2 spaced-repetition scheduling and review cap.
// Core insight: LeetCode != vocabulary. You can do 100 words/day but only 3-5 problems/day.
// Without a review cap, overdue reviews would eventually eat all daily slots.
//
// Architecture:
//   DailySlots = carryOver + min(reviews, reviewCap) + newProblems(remainder)
//   reviewCap = ceil(dailyQuota × 0.3), minimum 1 if any reviews due
//   Forgotten detection: overdue > 14 days → reset to unsolved (re-learn)

import { prisma } from '@/lib/prisma';
import { addLocalDays, localDayStart } from '@/lib/date';
import type { Problem, UserProblem } from '@prisma/client';
import dependenciesData from '@/data/dependencies.json';

// ── Types ──────────────────────────────────────────────────────────────

type DependenciesMap = Record<
  string,
  { prerequisites: string[]; dependents: string[] }
>;

export interface ProblemWithDetails extends Problem {
  userProblem?: Pick<
    UserProblem,
    'status' | 'mastery' | 'nextReviewAt' | 'reviewCount'
  > | null;
}

interface ReviewCandidate {
  userProblem: UserProblem;
  problem: Problem;
  daysOverdue: number;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Ratio of daily quota reserved for reviews (0.3 = 30%) */
const REVIEW_CAP_RATIO = 0.3;

/** Days past due before a problem is considered forgotten and reset to unsolved */
const FORGOTTEN_THRESHOLD_DAYS = 14;

// ── Scheduling Helper ──────────────────────────────────────────────────

/**
 * Compute the next review date using a simplified SM-2 inspired algorithm.
 */
export function computeNextReview(
  mastery: number,
  contestRating: number | null | undefined,
  nthReview: number,
  difficultyScore?: number,
): Date {
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

  return new Date(Date.now() + days * 86_400_000);
}

// ── Review Cap ─────────────────────────────────────────────────────────

/**
 * Maximum number of review problems allowed in the daily push.
 * ceil(quota × 0.3), minimum 1 if there are any overdue reviews.
 */
export function computeReviewCap(dailyQuota: number, hasReviews: boolean = true): number {
  if (!hasReviews) return 0;
  return Math.max(1, Math.ceil(dailyQuota * REVIEW_CAP_RATIO));
}

// ── Forgotten Detection ────────────────────────────────────────────────

/**
 * Check if a review is so overdue that the user has likely forgotten it.
 * When this happens, reset the UserProblem to unsolved state so it's
 * treated as a "new" problem in the current topic pool.
 */
async function handleForgottenProblems(
  candidates: ReviewCandidate[],
  today: Date,
): Promise<ReviewCandidate[]> {
  const forgotten: ReviewCandidate[] = [];
  const valid: ReviewCandidate[] = [];

  for (const c of candidates) {
    if (c.daysOverdue > FORGOTTEN_THRESHOLD_DAYS) {
      forgotten.push(c);
    } else {
      valid.push(c);
    }
  }

  // Reset forgotten problems to unsolved state
  if (forgotten.length > 0) {
    const forgottenIds = forgotten.map((f) => f.userProblem.problemId);
    await prisma.userProblem.updateMany({
      where: {
        userId: forgotten[0].userProblem.userId,
        problemId: { in: forgottenIds },
      },
      data: {
        status: 'unsolved',
        mastery: 0,
        nextReviewAt: null,
        lastReviewedAt: null,
        reviewCount: 0,
      },
    });
    console.log(
      `🔄 Forgot detection: reset ${forgotten.length} problems to unsolved (overdue > ${FORGOTTEN_THRESHOLD_DAYS}d)`,
    );
  }

  return valid;
}

// ── Prerequisite Checking ─────────────────────────────────────────────

let _depsCache: DependenciesMap | null = null;

function getDependencies(): DependenciesMap {
  if (!_depsCache) {
    _depsCache = dependenciesData as unknown as DependenciesMap;
  }
  return _depsCache;
}

export function arePrerequisitesMet(
  leetcodeId: string,
  userMastery: Map<string, number>,
): boolean {
  const deps = getDependencies();
  const entry = deps[leetcodeId];
  if (!entry || entry.prerequisites.length === 0) return true;

  return entry.prerequisites.every((preReqId) => {
    const mastery = userMastery.get(preReqId);
    return mastery !== undefined && mastery >= 2;
  });
}

// ── Overdue Review Fetching ────────────────────────────────────────────

async function getOverdueReviews(
  userId: string,
  today: Date,
  masteryByLeetcodeId: Map<string, number>,
): Promise<ReviewCandidate[]> {
  const userProblems = await prisma.userProblem.findMany({
    where: {
      userId,
      nextReviewAt: { lte: today },
      NOT: { nextReviewAt: null },
    },
    include: { problem: true },
  });

  return userProblems
    .filter((up) => {
      const leetcodeId = String(up.problem.leetcodeId);
      return arePrerequisitesMet(leetcodeId, masteryByLeetcodeId);
    })
    .map((up) => ({
      userProblem: up,
      problem: up.problem,
      daysOverdue: up.nextReviewAt
        ? Math.floor((today.getTime() - up.nextReviewAt.getTime()) / 86_400_000)
        : 0,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ── New Problem Selection ──────────────────────────────────────────────

async function getNewProblems(
  userId: string,
  count: number,
  masteryByLeetcodeId: Map<string, number>,
): Promise<ProblemWithDetails[]> {
  if (count <= 0) return [];

  // Determine user's plan for topic ordering
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true },
  });

  let planProblems: { problemId: number; order: number }[] = [];
  if (user?.planId) {
    const pp = await prisma.planProblem.findMany({
      where: { planId: user.planId },
      orderBy: { order: 'asc' },
      select: { problemId: true, order: true },
    });
    planProblems = pp;
  }

  // Fetch all unsolved UserProblems (no review schedule = truly new)
  const allUp = await prisma.userProblem.findMany({
    where: {
      userId,
      status: 'unsolved',
      nextReviewAt: null,
    },
    include: { problem: true },
  });

  if (allUp.length === 0) return [];

  const planProblemIds = new Set(planProblems.map((p) => p.problemId));

  // Find current topic: topic of the first unsolved plan problem
  let currentTopic: string | null = null;
  let nextTopic: string | null = null;

  const problemById = new Map<number, Problem>();
  for (const up of allUp) {
    problemById.set(up.problemId, up.problem);
  }

  if (planProblems.length > 0) {
    for (const pp of planProblems) {
      const prob = problemById.get(pp.problemId);
      if (prob && planProblemIds.has(pp.problemId) && allUp.some((up) => up.problemId === pp.problemId)) {
        currentTopic = prob.topic;
        // Find next topic
        for (const pp2 of planProblems) {
          if (pp2.order > pp.order) {
            const prob2 = problemById.get(pp2.problemId);
            if (prob2 && prob2.topic !== currentTopic) {
              nextTopic = prob2.topic;
              break;
            }
          }
        }
        break;
      }
    }
  }

  if (!currentTopic && allUp.length > 0) {
    currentTopic = allUp[0].problem.topic;
  }

  // Filter by current topic, then next topic, prioritized by prerequisites
  const filterByTopic = (topic: string | null) =>
    allUp.filter((up) => {
      if (topic && up.problem.topic !== topic) return false;
      const leetcodeId = String(up.problem.leetcodeId);
      return arePrerequisitesMet(leetcodeId, masteryByLeetcodeId);
    });

  const currentPool = filterByTopic(currentTopic).sort(
    (a, b) => a.problem.difficultyScore - b.problem.difficultyScore,
  );
  const nextPool = filterByTopic(nextTopic).sort(
    (a, b) => a.problem.difficultyScore - b.problem.difficultyScore,
  );

  const candidates = [...currentPool, ...nextPool].slice(0, count);

  return candidates.map((up) => ({
    ...up.problem,
    userProblem: {
      status: up.status,
      mastery: up.mastery,
      nextReviewAt: up.nextReviewAt,
      reviewCount: up.reviewCount,
    },
  }));
}

// ── Daily Push Generation (main entry) ─────────────────────────────────

/**
 * Generate today's daily push for a user.
 *
 * Allocation:
 *   1. Carry-over from yesterday (incomplete problems)
 *   2. Overdue reviews (capped at reviewCap — excess deferred to tomorrow)
 *   3. New problems from current topic (fill remaining quota)
 *
 * Forgotten detection: problems overdue > 14 days are reset to unsolved
 * and returned to the new-problem pool.
 */
export async function generateDailyPush(userId: string) {
  const today = localDayStart();
  const yesterday = addLocalDays(today, -1);

  // 1. Get user config
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyQuota: true },
  });
  if (!user) throw new Error(`User not found: ${userId}`);

  const quota = user.dailyQuota;

  // 2. Build mastery map for prerequisite checking
  const userProblems = await prisma.userProblem.findMany({
    where: { userId },
    select: { problem: { select: { leetcodeId: true } }, mastery: true },
  });
  const masteryByLeetcodeId = new Map<string, number>();
  for (const up of userProblems) {
    masteryByLeetcodeId.set(String(up.problem.leetcodeId), up.mastery ?? 0);
  }

  // 3. Carry-over from yesterday
  const yesterdayPush = await prisma.dailyPush.findUnique({
    where: { userId_date: { userId, date: yesterday } },
  });

  const carryOverIds: number[] = [];
  if (yesterdayPush && !yesterdayPush.isComplete) {
    const incomplete = yesterdayPush.problemIds.filter(
      (pid) => !yesterdayPush.completedIds.includes(pid),
    );
    carryOverIds.push(...incomplete);
  }

  // 4. Overdue reviews with cap + forgotten detection
  const overdueReviews = await getOverdueReviews(userId, today, masteryByLeetcodeId);
  const validReviews = await handleForgottenProblems(overdueReviews, today);

  const reviewCap = computeReviewCap(quota, validReviews.length > 0);
  const reviewIds = validReviews.slice(0, reviewCap).map((r) => r.userProblem.problemId);

  console.log(
    `📊 Push allocation: carryOver=${carryOverIds.length} review=${reviewIds.length}/${overdueReviews.length} (cap=${reviewCap}) quota=${quota}`,
  );

  // 5. New problems to fill remaining quota
  const remaining = quota - carryOverIds.length - reviewIds.length;
  const newProblems = await getNewProblems(userId, Math.max(0, remaining), masteryByLeetcodeId);
  const newProblemIds = newProblems.map((p) => p.id);

  // 6. Combine and upsert
  const allProblemIds = [...carryOverIds, ...reviewIds, ...newProblemIds];

  const dailyPush = await prisma.dailyPush.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      problemIds: allProblemIds,
      completedIds: [],
      ratedIds: [],
      isComplete: false,
    },
    update: {
      problemIds: allProblemIds,
    },
  });

  return dailyPush;
}

// ── Legacy: problem selection (kept for API compatibility) ─────────────

export async function getNextProblemsForUser(
  userId: string,
  count: number,
): Promise<ProblemWithDetails[]> {
  const masteryByLeetcodeId = new Map<string, number>();
  return getNewProblems(userId, count, masteryByLeetcodeId);
}
