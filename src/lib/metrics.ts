import type { DateRangePreset, HorizonMonthActivity, HorizonUserRow } from './types';

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

/** Fraction (0–1] of the real current calendar month that has elapsed so far. */
function currentMonthElapsedFraction(now: Date): number {
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return now.getUTCDate() / daysInMonth;
}

/**
 * Month keys safe to treat as "complete": every month before the real current
 * one, plus the current month itself once most of it has elapsed (>= 70% of
 * its days) — a month that's 30/31 days in is a fair comparison, but one
 * that's 3 days in isn't. Any month entirely in the future is always dropped.
 */
export function excludeCurrentMonth(months: string[], now: Date = new Date()): string[] {
  const currentMonth = monthKey(now);
  const includeCurrentMonth = currentMonthElapsedFraction(now) >= 0.7;
  return months.filter((m) => m < currentMonth || (m === currentMonth && includeCurrentMonth));
}

/**
 * How much more a month is projected to reach, on top of its actual total so
 * far, by scaling actual-to-date by how much of the real calendar month has
 * elapsed — e.g. $5,400 with 60% of the month elapsed projects to $9,000, a
 * remainder of $3,600. Zero for any month that isn't the real, currently
 * in-progress month (including the workbook's own latest month once it's
 * lagged behind the real calendar).
 */
function projectedRemainder(month: string, actual: number, now: Date): number {
  if (month !== monthKey(now)) return 0;
  const elapsed = currentMonthElapsedFraction(now);
  if (elapsed <= 0 || elapsed >= 1) return 0;
  return Math.max(0, actual / elapsed - actual);
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
  revenueByMonth: { month: string; label: string; revenue: number; projected: number }[];
}

/**
 * Sessions and revenue for the given month window. Evaluation isn't tracked
 * as a monthly count in the workbook — each user who selected "evaluation"
 * counts as exactly one evaluation session, dated to their registration
 * month (their intake). Coaching/Therapy session counts and dollar Value
 * come directly from each user's monthly activity blocks.
 *
 * `revenueByMonth[].projected` is the additional amount, on top of that
 * month's actual revenue, that the real current calendar month is on pace
 * to reach by its end — zero for every other month. It's a simple run-rate
 * extrapolation (actual-to-date ÷ fraction of the month elapsed), not a
 * forecast that accounts for seasonality or trend.
 */
export function computeHorizonPeriodMetrics(
  users: HorizonUserRow[],
  windowMonths: string[],
  now: Date = new Date()
): HorizonPeriodMetrics {
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
  const revenueByMonth = windowMonths.map((m) => {
    const revenue = revenueByMonthMap.get(m) ?? 0;
    return { month: m, label: monthLabel(m), revenue, projected: projectedRemainder(m, revenue, now) };
  });
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

/**
 * Billable members per month: a member counts in a given month if they had
 * at least one coaching or therapy session that month — a snapshot per
 * month, not a running/cumulative total (unlike `computeEngagedGrowth`,
 * which tracks the first month someone ever became engaged).
 */
export function computeBillableMembersByMonth(
  users: HorizonUserRow[],
  windowMonths: string[]
): { month: string; label: string; count: number }[] {
  const windowSet = new Set(windowMonths);
  const counts = new Map<string, number>();
  for (const m of windowMonths) counts.set(m, 0);
  for (const user of users) {
    for (const activity of user.monthly) {
      if (!windowSet.has(activity.month)) continue;
      if (activity.coachingSessions > 0 || activity.therapySessions > 0) {
        counts.set(activity.month, (counts.get(activity.month) ?? 0) + 1);
      }
    }
  }
  return windowMonths.map((m) => ({ month: m, label: monthLabel(m), count: counts.get(m) ?? 0 }));
}

// Flat per-month program fee used to approximate "coaching revenue" for a
// patient-month, matching the methodology in the investor engagement/LTV
// analysis: a month counts as coaching if it had 1+ coaching session or 30+
// minutes of coach messaging. This is the same proxy that package uses —
// not a real line item from billing — so it's an approximation here too.
const COACHING_FEE = 150;

function isCoachingMonth(activity: HorizonMonthActivity): boolean {
  return activity.coachingSessions > 0 || activity.coachMessagingMinutes >= 30;
}

/** A patient is "coaching-engaged" if any month of theirs ever qualified as a coaching month. */
export function isCoachingEngaged(user: HorizonUserRow): boolean {
  return user.monthly.some(isCoachingMonth);
}

/**
 * Coaching's share of total revenue by month: sum of the flat per-patient
 * coaching fee for every coaching-qualifying patient-month, divided by that
 * month's real total `Value`. An approximation (there's no per-feature price
 * breakdown in the workbook), not an exact billing split.
 */
export function computeCoachingShareByMonth(
  users: HorizonUserRow[],
  windowMonths: string[]
): { month: string; label: string; share: number }[] {
  const windowSet = new Set(windowMonths);
  const coachingFee = new Map<string, number>();
  const totalValue = new Map<string, number>();
  for (const m of windowMonths) {
    coachingFee.set(m, 0);
    totalValue.set(m, 0);
  }
  for (const user of users) {
    for (const activity of user.monthly) {
      if (!windowSet.has(activity.month)) continue;
      totalValue.set(activity.month, (totalValue.get(activity.month) ?? 0) + activity.value);
      if (isCoachingMonth(activity)) {
        coachingFee.set(activity.month, (coachingFee.get(activity.month) ?? 0) + COACHING_FEE);
      }
    }
  }
  return windowMonths.map((m) => {
    const total = totalValue.get(m) ?? 0;
    return { month: m, label: monthLabel(m), share: total > 0 ? (coachingFee.get(m) ?? 0) / total : 0 };
  });
}

export interface CoachingValueComparison {
  coachingLabel: string;
  coachingAvgValue: number;
  coachingCount: number;
  therapyOnlyLabel: string;
  therapyOnlyAvgValue: number;
  therapyOnlyCount: number;
}

/**
 * Average total value to date (sum of every month's `Value`) for
 * coaching-engaged patients vs. patients who've only ever had therapy
 * sessions — the "$642 vs $381 per patient" comparison from the investor
 * LTV analysis. All-time, not window-filtered: this is a patient-level
 * classification, not a per-period figure.
 */
export function computeCoachingValueComparison(users: HorizonUserRow[]): CoachingValueComparison {
  const totalValue = (u: HorizonUserRow) => u.monthly.reduce((sum, m) => sum + m.value, 0);
  const avg = (list: HorizonUserRow[]) => (list.length === 0 ? 0 : list.reduce((s, u) => s + totalValue(u), 0) / list.length);

  const coaching = users.filter(isCoachingEngaged);
  const therapyOnly = users.filter((u) => !isCoachingEngaged(u) && u.monthly.some((m) => m.therapySessions > 0));

  return {
    coachingLabel: 'Coaching-engaged',
    coachingAvgValue: avg(coaching),
    coachingCount: coaching.length,
    therapyOnlyLabel: 'Therapy-only',
    therapyOnlyAvgValue: avg(therapyOnly),
    therapyOnlyCount: therapyOnly.length,
  };
}

/**
 * `projected` is the additional new-patient count, on top of the real
 * current month's actual count so far, that the month is on pace to reach
 * by its end (see `computeHorizonPeriodMetrics` for the same run-rate
 * method) — zero for every other month. Rounded, since a fractional person
 * doesn't mean anything here.
 */
export function computeNewPatientsByMonth(
  users: HorizonUserRow[],
  windowMonths: string[],
  now: Date = new Date()
): { month: string; label: string; count: number; projected: number }[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    const m = monthKey(u.createdAt);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return windowMonths.map((m) => {
    const count = counts.get(m) ?? 0;
    return { month: m, label: monthLabel(m), count, projected: Math.round(projectedRemainder(m, count, now)) };
  });
}

/**
 * Visits every (user, offset, month) a cohort analysis can observe: for each
 * user whose registration month is itself one of `allMonths` (so "month 0"
 * is actually in the data), walks offset 0, 1, 2, ... up to however far that
 * user's cohort has aged within the workbook's tracked history. A user
 * registered before the workbook's earliest tracked month is skipped — their
 * true month 0 isn't observable, so there's no honest offset to anchor them to.
 */
function forEachCohortOffset(
  users: HorizonUserRow[],
  allMonths: string[],
  visit: (user: HorizonUserRow, offset: number, month: string) => void
): void {
  const monthIndex = new Map(allMonths.map((m, i) => [m, i]));
  const maxIndex = allMonths.length - 1;
  for (const user of users) {
    const cohortIdx = monthIndex.get(monthKey(user.createdAt));
    if (cohortIdx == null) continue;
    const maxOffset = maxIndex - cohortIdx;
    for (let offset = 0; offset <= maxOffset; offset++) {
      visit(user, offset, allMonths[cohortIdx + offset]);
    }
  }
}

export type RetentionPoint = {
  offset: number;
  label: string;
  rate: number;
  cohortSize: number;
};

/**
 * Blended retention curve: % of each cohort still billable (1+ coaching or
 * therapy session) N months after their registration month, averaged across
 * every cohort that's aged far enough to have an observed value at that
 * offset. `cohortSize` shrinks at higher offsets, since only the earliest
 * cohorts have aged that far yet — read the tail of the curve as thinner
 * evidence than the start.
 */
export function computeRetentionCurve(users: HorizonUserRow[], allMonths: string[]): RetentionPoint[] {
  const cohortSizeByOffset = new Map<number, number>();
  const activeByOffset = new Map<number, number>();
  let maxObservedOffset = 0;

  forEachCohortOffset(users, allMonths, (user, offset, month) => {
    cohortSizeByOffset.set(offset, (cohortSizeByOffset.get(offset) ?? 0) + 1);
    maxObservedOffset = Math.max(maxObservedOffset, offset);
    const isActive = user.monthly.some((m) => m.month === month && (m.coachingSessions > 0 || m.therapySessions > 0));
    if (isActive) activeByOffset.set(offset, (activeByOffset.get(offset) ?? 0) + 1);
  });

  const points: RetentionPoint[] = [];
  for (let offset = 0; offset <= maxObservedOffset; offset++) {
    const cohortSize = cohortSizeByOffset.get(offset) ?? 0;
    points.push({
      offset,
      label: `Month ${offset}`,
      rate: cohortSize > 0 ? (activeByOffset.get(offset) ?? 0) / cohortSize : 0,
      cohortSize,
    });
  }
  return points;
}

export type CohortRetentionSeries = {
  cohort: string; // e.g. "Jul 2026"
  size: number;
};

export type CohortRetentionResult = {
  data: { offset: number; label: string; [cohort: string]: number | string | null }[];
  series: CohortRetentionSeries[];
};

/**
 * Same retention definition as `computeRetentionCurve`, broken out one line
 * per registration-month cohort instead of blended into a single weighted
 * average. A cohort's value is `null` (a gap, not a drop to zero) for any
 * offset it hasn't aged into yet — only offsets it's actually reached get a
 * real 0%-or-higher rate.
 */
export function computeRetentionCurveByCohort(users: HorizonUserRow[], allMonths: string[]): CohortRetentionResult {
  const cohortSizes = new Map<string, number>(); // keyed by raw "YYYY-MM", not the display label
  const maxOffsetByCohort = new Map<string, number>();
  const activeByCohortOffset = new Map<string, Map<number, number>>();
  let maxOffsetOverall = 0;

  forEachCohortOffset(users, allMonths, (user, offset, month) => {
    const cohortKey = monthKey(user.createdAt);
    if (offset === 0) cohortSizes.set(cohortKey, (cohortSizes.get(cohortKey) ?? 0) + 1);
    maxOffsetByCohort.set(cohortKey, Math.max(maxOffsetByCohort.get(cohortKey) ?? 0, offset));
    maxOffsetOverall = Math.max(maxOffsetOverall, offset);
    const isActive = user.monthly.some((m) => m.month === month && (m.coachingSessions > 0 || m.therapySessions > 0));
    if (isActive) {
      if (!activeByCohortOffset.has(cohortKey)) activeByCohortOffset.set(cohortKey, new Map());
      const byOffset = activeByCohortOffset.get(cohortKey)!;
      byOffset.set(offset, (byOffset.get(offset) ?? 0) + 1);
    }
  });

  const cohortKeys = [...cohortSizes.keys()].sort(); // "YYYY-MM" sorts chronologically as plain strings
  const series: CohortRetentionSeries[] = cohortKeys.map((key) => ({ cohort: monthLabel(key), size: cohortSizes.get(key)! }));

  const data: CohortRetentionResult['data'] = [];
  for (let offset = 0; offset <= maxOffsetOverall; offset++) {
    const row: CohortRetentionResult['data'][number] = { offset, label: `Month ${offset}` };
    for (const key of cohortKeys) {
      const reached = offset <= (maxOffsetByCohort.get(key) ?? -1);
      row[monthLabel(key)] = reached ? (activeByCohortOffset.get(key)?.get(offset) ?? 0) / cohortSizes.get(key)! : null;
    }
    data.push(row);
  }

  return { data, series };
}

export type LtvCurvePoint = {
  offset: number;
  label: string;
  avgValue: number;
  cohortSize: number;
};

/**
 * Average cumulative value per patient, N months after their registration
 * month — observed to date, not a modeled/extrapolated projection. Same
 * cohort-offset basis as `computeRetentionCurve`, so the two read together.
 */
export function computeLtvCurve(users: HorizonUserRow[], allMonths: string[]): LtvCurvePoint[] {
  const sumByOffset = new Map<number, number>();
  const cohortSizeByOffset = new Map<number, number>();
  let maxObservedOffset = 0;
  let currentUser: HorizonUserRow | null = null;
  let cumulative = 0;

  forEachCohortOffset(users, allMonths, (user, offset, month) => {
    if (user !== currentUser) {
      currentUser = user;
      cumulative = 0;
    }
    cumulative += user.monthly.find((m) => m.month === month)?.value ?? 0;
    sumByOffset.set(offset, (sumByOffset.get(offset) ?? 0) + cumulative);
    cohortSizeByOffset.set(offset, (cohortSizeByOffset.get(offset) ?? 0) + 1);
    maxObservedOffset = Math.max(maxObservedOffset, offset);
  });

  const points: LtvCurvePoint[] = [];
  for (let offset = 0; offset <= maxObservedOffset; offset++) {
    const cohortSize = cohortSizeByOffset.get(offset) ?? 0;
    points.push({
      offset,
      label: `Month ${offset}`,
      avgValue: cohortSize > 0 ? (sumByOffset.get(offset) ?? 0) / cohortSize : 0,
      cohortSize,
    });
  }
  return points;
}

const LTV_BUCKETS: { label: string; test: (v: number) => boolean }[] = [
  { label: '$0', test: (v) => v === 0 },
  { label: '$1–499', test: (v) => v >= 1 && v < 500 },
  { label: '$500–999', test: (v) => v >= 500 && v < 1000 },
  { label: '$1,000–1,499', test: (v) => v >= 1000 && v < 1500 },
  { label: '$1,500+', test: (v) => v >= 1500 },
];

/** Patient count by all-time total value bucket — a snapshot, not a trend. */
export function computeLtvDistribution(users: HorizonUserRow[]): { label: string; count: number }[] {
  const totalValue = (u: HorizonUserRow) => u.monthly.reduce((sum, m) => sum + m.value, 0);
  const values = users.map(totalValue);
  return LTV_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: values.filter(bucket.test).length,
  }));
}
