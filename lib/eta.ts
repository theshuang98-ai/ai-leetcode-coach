/** Returns today's date as YYYY-MM-DD string */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Computes estimated time of arrival (ETA) for completing all problems.
 *
 * Formula:
 *   effectiveRate = max(1, dailyQuota - ceil(dailyQuota * 0.3))
 *   daysRemaining = ceil((totalProblems - solved) / effectiveRate)
 *
 * The 30% discount accounts for review / overhead; Math.max(1, ...) ensures
 * the effective rate never drops below 1, avoiding division by zero when
 * dailyQuota is 1.
 *
 * @param dailyQuota  Number of problems the user plans to solve per day
 * @param totalProblems Total number of problems in the plan
 * @param solved       Number of problems already solved
 * @returns Object with:
 *   - daysRemaining  Estimated days needed (0 if already done)
 *   - date           Target completion date in YYYY-MM-DD format
 *   - effectiveRate  Adjusted daily rate after overhead discount
 */
export function computeETA(
  dailyQuota: number,
  totalProblems: number,
  solved: number,
): { daysRemaining: number; date: string; effectiveRate: number } {
  const effectiveRate = Math.max(1, dailyQuota - Math.ceil(dailyQuota * 0.3));

  if (solved >= totalProblems || totalProblems === 0) {
    return {
      daysRemaining: 0,
      date: todayISO(),
      effectiveRate,
    };
  }

  const daysRemaining = Math.ceil((totalProblems - solved) / effectiveRate);
  const date = new Date(Date.now() + daysRemaining * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return { daysRemaining, date, effectiveRate };
}
