import type { DateRangePreset, HorizonUserRow } from './types';

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function addMonths(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(d);
}

/** Inclusive list of month keys spanning start..end. */
export function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 1000) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return out;
}

/**
 * Month keys safe to treat as "complete": every month before the real current
 * one, plus the current month itself once most of it has elapsed (>= 70% of
 * its days) — a month that's 30/31 days in is a fair comparison, but one
 * that's 3 days in isn't. Any month entirely in the future is always dropped.
 */
export function excludeCurrentMonth(months: string[], now: Date = new Date()): string[] {
  const currentMonth = monthKey(now);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsedFraction = now.getUTCDate() / daysInMonth;
  const includeCurrentMonth = elapsedFraction >= 0.7;
  return months.filter((m) => m < currentMonth || (m === currentMonth && includeCurrentMonth));
}

/**
 * Narrows the workbook's full month range down to the date-range preset's
 * window, anchored to the latest month actually present in the data (not
 * today's real-world date, so the window stays meaningful regardless of
 * when the workbook was last updated).
 */
export function resolveHorizonMonthWindow(preset: DateRangePreset, allMonths: string[]): string[] {
  if (allMonths.length === 0) return [];
  const latest = allMonths[allMonths.length - 1];
  const lastN = (n: number) => {
    const start = addMonths(latest, -(n - 1));
    return allMonths.filter((m) => m >= start);
  };
  switch (preset) {
    case 'ytd': {
      const year = latest.split('-')[0];
      return allMonths.filter((m) => m.startsWith(`${year}-`));
    }
    case 'last3':
      return lastN(3);
    case 'last6':
      return lastN(6);
    case 'last12':
      return lastN(12);
    default:
      return allMonths;
  }
}

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  total: number;
  [series: string]: number | string;
}

// Fixed, known category set — unlike the old free-text visit-type breakdown,
// there's no need to cap/bucket into "Other" here.
export const HORIZON_SERIES_KEYS = ['Evaluation', 'Coaching', 'Therapy'];

export interface HorizonPeriodMetrics {
  totalSessions: number;
  revenue: number;
  sessionsByMonth: MonthlySeriesPoint[];
  revenueByMonth: { month: string; label: string; revenue: number }[];
}

/**
 * Sessions and revenue for the given month window. Evaluation isn't tracked
 * as a monthly count in the workbook — each user who selected "evaluation"
 * counts as exactly one evaluation session, dated to their registration
 * month (their intake). Coaching/Therapy session counts and dollar Value
 * come directly from each user's monthly activity blocks.
 */
export function computeHorizonPeriodMetrics(users: HorizonUserRow[], windowMonths: string[]): HorizonPeriodMetrics {
  const windowSet = new Set(windowMonths);
  const byMonth = new Map<string, MonthlySeriesPoint>();
  const revenueByMonthMap = new Map<string, number>();
  for (const m of windowMonths) {
    byMonth.set(m, { month: m, label: monthLabel(m), total: 0, Evaluation: 0, Coaching: 0, Therapy: 0 });
    revenueByMonthMap.set(m, 0);
  }

  for (const user of users) {
    if (user.serviceSelected === 'evaluation') {
      const m = monthKey(user.createdAt);
      const point = byMonth.get(m);
      if (point) {
        point.Evaluation = (point.Evaluation as number) + 1;
        point.total = (point.total as number) + 1;
      }
    }
    for (const activity of user.monthly) {
      if (!windowSet.has(activity.month)) continue;
      const point = byMonth.get(activity.month)!;
      point.Coaching = (point.Coaching as number) + activity.coachingSessions;
      point.Therapy = (point.Therapy as number) + activity.therapySessions;
      point.total = (point.total as number) + activity.coachingSessions + activity.therapySessions;
      revenueByMonthMap.set(activity.month, (revenueByMonthMap.get(activity.month) ?? 0) + activity.value);
    }
  }

  const sessionsByMonth = windowMonths.map((m) => byMonth.get(m)!);
  const revenueByMonth = windowMonths.map((m) => ({ month: m, label: monthLabel(m), revenue: revenueByMonthMap.get(m) ?? 0 }));
  const totalSessions = sessionsByMonth.reduce((sum, p) => sum + (p.total as number), 0);
  const revenue = revenueByMonth.reduce((sum, p) => sum + p.revenue, 0);

  return { totalSessions, revenue, sessionsByMonth, revenueByMonth };
}

/** Total registered users, all-time (not window-filtered — a running total, not a per-period figure). */
export function countRegistered(users: HorizonUserRow[]): number {
  return users.length;
}

/** A user is "engaged in care" once they have any coaching or therapy session in any tracked month. */
export function isEngaged(user: HorizonUserRow): boolean {
  return user.monthly.some((m) => m.coachingSessions > 0 || m.therapySessions > 0);
}

export function countEngaged(users: HorizonUserRow[]): number {
  return users.filter(isEngaged).length;
}

/** The first month a user has any coaching/therapy session, or null if never engaged. Assumes `monthly` is chronological. */
function firstEngagedMonth(user: HorizonUserRow): string | null {
  for (const m of user.monthly) {
    if (m.coachingSessions > 0 || m.therapySessions > 0) return m.month;
  }
  return null;
}

/**
 * Cumulative growth curve over `windowMonths`, seeded with anyone whose
 * first occurrence of `monthOf(item)` falls before the window — so the
 * curve reads correctly even when the window is narrowed (e.g. "Last 3
 * months") rather than always starting from zero.
 */
function computeCumulativeGrowth(monthsOccurred: string[], windowMonths: string[]): { month: string; label: string; total: number }[] {
  const countsByMonth = new Map<string, number>();
  for (const m of monthsOccurred) countsByMonth.set(m, (countsByMonth.get(m) ?? 0) + 1);
  const priorCount = monthsOccurred.filter((m) => windowMonths.length === 0 || m < windowMonths[0]).length;
  let running = priorCount;
  return windowMonths.map((m) => {
    running += countsByMonth.get(m) ?? 0;
    return { month: m, label: monthLabel(m), total: running };
  });
}

export function computeRegisteredGrowth(users: HorizonUserRow[], windowMonths: string[]): { month: string; label: string; total: number }[] {
  return computeCumulativeGrowth(users.map((u) => monthKey(u.createdAt)), windowMonths);
}

export function computeEngagedGrowth(users: HorizonUserRow[], windowMonths: string[]): { month: string; label: string; total: number }[] {
  const firstMonths = users.map(firstEngagedMonth).filter((m): m is string => m != null);
  return computeCumulativeGrowth(firstMonths, windowMonths);
}

export function computeNewPatientsByMonth(
  users: HorizonUserRow[],
  windowMonths: string[]
): { month: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    const m = monthKey(u.createdAt);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return windowMonths.map((m) => ({ month: m, label: monthLabel(m), count: counts.get(m) ?? 0 }));
}
