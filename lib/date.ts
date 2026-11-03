/**
 * Local-calendar-day helpers.
 *
 * Prisma `@db.Date` stores the UTC date part. Using `setHours(0,0,0,0)` on a
 * Shanghai machine yields the *previous* UTC day (16:00Z), so every "today"
 * lookup was off by one. We represent a local calendar day as UTC midnight of
 * that local date instead — DB key and display then agree.
 */
export function localDayStart(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function localDayKey(date: Date = new Date()): string {
  return localDayStart(date).toISOString().slice(0, 10);
}
