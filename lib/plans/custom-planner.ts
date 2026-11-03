/**
 * Custom Plan Problem Picker.
 *
 * Given a pool of problems, user topic preferences, and a target count,
 * picks `total` problems with proportional topic distribution,
 * sorted by difficulty (easiest first) within each topic.
 */
export interface ProblemData {
  id: number;
  leetcodeId: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  difficultyScore: number;
  topic: string;
}

export function pickCustomPlanProblems(
  problems: ProblemData[],
  preferences: string[],
  total: number,
): ProblemData[] {
  if (total <= 0 || preferences.length === 0) return [];

  // 1. Normalise preferences to lowercase for case-insensitive matching
  const preferredTopics = new Set(preferences.map((t) => t.toLowerCase()));

  // 2. Filter problems that match at least one preferred topic
  const filtered = problems.filter((p) =>
    preferredTopics.has(p.topic.toLowerCase()),
  );

  if (filtered.length === 0) return [];
  if (filtered.length <= total) return filtered;

  // 3. Group by topic
  const byTopic = new Map<string, ProblemData[]>();
  for (const p of filtered) {
    const list = byTopic.get(p.topic) ?? [];
    list.push(p);
    byTopic.set(p.topic, list);
  }

  // 4. Distribute proportionally across topics
  const topics = [...byTopic.keys()];
  const result: ProblemData[] = [];
  const usedIds = new Set<number>();

  const basePerTopic = Math.floor(total / topics.length);
  let remainder = total - basePerTopic * topics.length;

  // Sort topics by problem count ascending (take from smaller topics first)
  topics.sort(
    (a, b) => (byTopic.get(a)?.length ?? 0) - (byTopic.get(b)?.length ?? 0),
  );

  for (const topic of topics) {
    const pool = byTopic.get(topic) ?? [];

    // 5. Within each topic sort by difficultyScore ASC (then leetcodeId for determinism)
    pool.sort(
      (a, b) =>
        a.difficultyScore - b.difficultyScore || a.leetcodeId - b.leetcodeId,
    );

    let take = basePerTopic;
    if (remainder > 0) {
      take += 1;
      remainder -= 1;
    }

    const available = pool.filter((p) => !usedIds.has(p.leetcodeId));
    const picked = available.slice(0, Math.min(take, available.length));

    for (const p of picked) {
      usedIds.add(p.leetcodeId);
      result.push(p);
    }
  }

  // 6. Fill remaining slots if we couldn't reach `total`
  if (result.length < total) {
    const remaining = filtered.filter((p) => !usedIds.has(p.leetcodeId));
    remaining.sort(
      (a, b) =>
        a.difficultyScore - b.difficultyScore || a.leetcodeId - b.leetcodeId,
    );
    const extra = remaining.slice(0, total - result.length);
    result.push(...extra);
  }

  return result;
}
