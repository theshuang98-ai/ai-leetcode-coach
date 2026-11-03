/**
 * Database seed script — MVP Internal Test
 *
 * Single plan: Hot 100 (205 problems across 12 topics).
 * Problems grouped by topic, ordered Easy → Medium → Hard within each topic.
 * Topic order follows logical progression: Arrays → Pointers → Search → Structures → Trees → DP → Advanced.
 *
 * Run via: npm run db:seed (→ scripts/seed.ts → this file)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawProblem {
  id?: number;
  leetcodeId?: number;
  title: string;
  titleCn?: string;
  slug: string;
  difficulty: string;
  difficultyScore: number;
  contestRating?: number;
  topic: string;
}

interface ProblemData {
  leetcodeId: number;
  title: string;
  titleCn: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  difficultyScore: number;
  contestRating?: number;
  topic: string;
}

// ── Topic ordering for logical learning progression ──────────────────
const TOPIC_ORDER: Record<string, number> = {
  'Arrays & Hashing': 1,
  'Two Pointers': 2,
  'Sliding Window': 3,
  'Binary Search': 4,
  'Stack & Queue': 5,
  'Linked List': 6,
  'Trees & Graphs': 7,
  'Dynamic Programming': 8,
  'Backtracking': 9,
  'Greedy': 10,
  'Intervals': 11,
  'Math & Bit Manipulation': 12,
};

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

// ── Helpers ────────────────────────────────────────────────────────────

function normalizeProblem(raw: RawProblem): ProblemData | null {
  const leetcodeId = raw.leetcodeId ?? raw.id;
  if (typeof leetcodeId !== 'number') return null;
  if (!['Easy', 'Medium', 'Hard'].includes(raw.difficulty)) return null;
  if (typeof raw.title !== 'string' || typeof raw.slug !== 'string') return null;
  if (typeof raw.difficultyScore !== 'number' || typeof raw.topic !== 'string') return null;

  return {
    leetcodeId,
    title: raw.title,
    titleCn: raw.titleCn ?? '',
    slug: raw.slug,
    difficulty: raw.difficulty as 'Easy' | 'Medium' | 'Hard',
    difficultyScore: raw.difficultyScore,
    contestRating: raw.contestRating,
    topic: raw.topic,
  };
}

function loadProblems(): ProblemData[] {
  const problemsPath = path.resolve(process.cwd(), 'data', 'problems.json');
  if (!fs.existsSync(problemsPath)) {
    console.warn('⚠️  data/problems.json not found. Skip seeding problems.');
    return [];
  }

  let raw: string;
  try { raw = fs.readFileSync(problemsPath, 'utf-8'); }
  catch (err) { console.warn('⚠️  Failed to read data/problems.json:', err); return []; }

  let items: RawProblem[];
  try {
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : (parsed?.problems ?? []);
  } catch (err) {
    console.warn('⚠️  Failed to parse data/problems.json:', err);
    return [];
  }

  const valid = items.map(normalizeProblem).filter((p): p is ProblemData => p !== null);
  if (valid.length !== items.length) {
    console.warn(`⚠️  Filtered out ${items.length - valid.length} invalid entries.`);
  }
  return valid;
}

/**
 * Sort problems by topic (logical order), then difficulty (Easy→Hard),
 * then difficultyScore ascending for deterministic ordering.
 */
function sortByTopicAndDifficulty(problems: ProblemData[]): ProblemData[] {
  return [...problems].sort((a, b) => {
    const topicA = TOPIC_ORDER[a.topic] ?? 99;
    const topicB = TOPIC_ORDER[b.topic] ?? 99;
    if (topicA !== topicB) return topicA - topicB;
    const diffA = DIFFICULTY_ORDER[a.difficulty] ?? 0;
    const diffB = DIFFICULTY_ORDER[b.difficulty] ?? 0;
    if (diffA !== diffB) return diffA - diffB;
    return a.difficultyScore - b.difficultyScore || a.leetcodeId - b.leetcodeId;
  });
}

// ── Seed functions ──────────────────────────────────────────────────────

async function seedProblems(problems: ProblemData[]): Promise<void> {
  console.log(`📦 Seeding ${problems.length} problems...`);
  let created = 0, skipped = 0;

  for (const p of problems) {
    const existing = await prisma.problem.findUnique({ where: { leetcodeId: p.leetcodeId } });
    if (existing) { skipped++; continue; }

    await prisma.problem.create({
      data: {
        leetcodeId: p.leetcodeId,
        title: p.title,
        titleCn: p.titleCn || null,
        slug: p.slug,
        difficulty: p.difficulty,
        difficultyScore: p.difficultyScore,
        contestRating: p.contestRating ?? null,
        topic: p.topic,
      },
    });
    created++;
  }
  console.log(`   ✅ Created ${created} problems (${skipped} skipped — already exist)`);
}

async function seedHot100Plan(problems: ProblemData[]): Promise<void> {
  const planName = 'Hot 100';
  const existing = await prisma.plan.findFirst({ where: { name: planName } });

  if (existing) {
    // Check if plan problems need updating (new problems added to seed data)
    const ppCount = await prisma.planProblem.count({ where: { planId: existing.id } });
    if (ppCount >= problems.length) {
      console.log(`   ⏭️  Plan "${planName}" already exists with ${ppCount}/${problems.length} problems.`);
      return;
    }
    console.log(`   🔄  Plan "${planName}" has ${ppCount}/${problems.length} problems. Updating...`);
    // Delete old PlanProblems and re-link
    await prisma.planProblem.deleteMany({ where: { planId: existing.id } });
    await prisma.plan.update({ where: { id: existing.id }, data: { totalProblems: problems.length } });
  }

  const plan = existing ?? await prisma.plan.create({
    data: {
      name: planName,
      totalProblems: problems.length,
      description: 'LeetCode Hot 100 扩展题单，覆盖 12 大专题，按难度循序渐进。',
    },
  });

  if (!existing) {
    console.log(`   ✅ Created plan: "${planName}" (id=${plan.id})`);
  }

  // Sort problems by topic + difficulty for logical progression
  const sorted = sortByTopicAndDifficulty(problems);
  const problemIdsInDb: number[] = [];

  for (const p of sorted) {
    const dbProblem = await prisma.problem.findUnique({ where: { leetcodeId: p.leetcodeId } });
    if (dbProblem) problemIdsInDb.push(dbProblem.id);
  }

  // Link problems to plan in topic-grouped order
  console.log(`   📎 Linking ${problemIdsInDb.length} problems to "${planName}"...`);

  for (let i = 0; i < problemIdsInDb.length; i++) {
    await prisma.planProblem.upsert({
      where: { planId_problemId: { planId: plan.id, problemId: problemIdsInDb[i] } },
      create: { planId: plan.id, problemId: problemIdsInDb[i], order: i + 1 },
      update: { order: i + 1 },
    });
  }

  console.log(`   ✅ Linked ${problemIdsInDb.length} problems to "${planName}".`);
}

async function cleanOldPlans(): Promise<void> {
  // Remove old plans (核心面试100题, 速成66题, 自定义) — keep only Hot 100
  const oldPlanNames = ['核心面试 100 题', '速成 66 题', '自定义'];
  for (const name of oldPlanNames) {
    const plan = await prisma.plan.findFirst({ where: { name } });
    if (plan) {
      await prisma.planProblem.deleteMany({ where: { planId: plan.id } });
      await prisma.plan.delete({ where: { id: plan.id } });
      console.log(`   🗑️  Removed old plan: "${name}"`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Seeding database (MVP — Hot 100 only)...');
  console.log('');

  const problems = loadProblems();
  if (problems.length === 0) {
    console.log('📭 No problems to seed. Aborting.');
    return;
  }

  // 1. Seed problems
  await seedProblems(problems);
  console.log('');

  // 2. Clean up old plans
  await cleanOldPlans();
  console.log('');

  // 3. Seed Hot 100 plan (topic-grouped, Easy→Hard)
  await seedHot100Plan(problems);
  console.log('');

  console.log('✅ Seed complete.');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
