import type { AppointmentRow, DateRange } from './types';

export const SELF_PAY_LABEL = 'Self-pay / Other';
export const REVENUE_PER_SESSION = 140;
const OTHER_LABEL = 'Other';
const MAX_SERIES = 4;
const MAX_BAR_CATEGORIES = 8;

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function addMonths(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(d);
}

/** Inclusive list of month keys spanning start..end (both derived from data if not given). */
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

export function accountLabel(account: string | null): string {
  return account ?? SELF_PAY_LABEL;
}

export function filterByRange(rows: AppointmentRow[], range: DateRange): AppointmentRow[] {
  if (!range.start && !range.end) return rows;
  return rows.filter((row) => {
    if (range.start && row.scheduledFor < range.start) return false;
    if (range.end && row.scheduledFor > range.end) return false;
    return true;
  });
}

/** Latest scheduled appointment date across `rows`, or null if empty. */
export function latestDate(rows: AppointmentRow[]): Date | null {
  if (rows.length === 0) return null;
  return rows.reduce((max, r) => (r.scheduledFor > max ? r.scheduledFor : max), rows[0].scheduledFor);
}

/** Range covering the last `n` months ending with the month of the latest row (inclusive). */
export function lastNMonthsRange(n: number, rows: AppointmentRow[]): DateRange {
  const latest = latestDate(rows);
  if (!latest) return { start: null, end: null };
  const endOfMonth = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0, 23, 59, 59));
  const start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - (n - 1), 1));
  return { start, end: endOfMonth };
}

export function resolveDateRange(preset: string, rows: AppointmentRow[]): DateRange {
  const latest = latestDate(rows);
  if (!latest) return { start: null, end: null };
  const endOfMonth = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0, 23, 59, 59));

  switch (preset) {
    case 'ytd':
      return { start: new Date(Date.UTC(latest.getUTCFullYear(), 0, 1)), end: endOfMonth };
    case 'last3':
      return lastNMonthsRange(3, rows);
    case 'last6':
      return lastNMonthsRange(6, rows);
    case 'last12':
      return lastNMonthsRange(12, rows);
    default:
      return { start: null, end: null };
  }
}

/** Month keys strictly before the real current month — excludes an in-progress trailing month. */
export function excludeCurrentMonth(months: string[]): string[] {
  const currentMonth = monthKey(new Date());
  return months.filter((m) => m < currentMonth);
}

/** Continuous month axis covering `range`, falling back to the full span of `rows` for an open range. */
export function monthsForRange(rows: AppointmentRow[], range: DateRange): string[] {
  if (range.start && range.end) {
    return monthRange(monthKey(range.start), monthKey(range.end));
  }
  if (rows.length === 0) return [];
  const dates = rows.map((r) => r.scheduledFor);
  const min = dates.reduce((a, b) => (b < a ? b : a));
  const max = dates.reduce((a, b) => (b > a ? b : a));
  return monthRange(monthKey(range.start ?? min), monthKey(range.end ?? max));
}

export function listAccounts(rows: AppointmentRow[]): { name: string; sessions: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.account) continue;
    counts.set(row.account, (counts.get(row.account) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

/** Earliest scheduled appointment per patient, across the given rows. */
export function firstAppointmentByPatient(rows: AppointmentRow[]): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const row of rows) {
    const existing = map.get(row.patient);
    if (!existing || row.scheduledFor < existing) {
      map.set(row.patient, row.scheduledFor);
    }
  }
  return map;
}

function topCategories(counts: Map<string, number>, max: number): Map<string, number> {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length <= max) return new Map(sorted);
  const top = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((sum, [, v]) => sum + v, 0);
  const result = new Map(top);
  result.set(OTHER_LABEL, rest);
  return result;
}

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  total: number;
  [series: string]: number | string;
}

export interface DashboardMetrics {
  totalSessions: number;
  uniquePatients: number;
  newPatients: number;
  showUpRate: number | null;
  months: string[];
  sessionsByMonth: MonthlySeriesPoint[];
  seriesKeys: string[];
  newPatientsByMonth: { month: string; label: string; count: number }[];
  cumulativePatients: { month: string; label: string; total: number }[];
  accountMix: { name: string; count: number }[];
  momGrowthPct: number | null;
  revenue: number;
  revenueByMonth: { month: string; label: string; revenue: number }[];
}

/**
 * Core metrics for a set of rows. `scopeRows` (defaults to `rows`) determines
 * which rows count toward "first appointment ever" for new-patient detection —
 * pass the account's full history so a patient isn't miscounted as new every
 * time the visible date range changes.
 */
export function computeMetrics(
  rows: AppointmentRow[],
  months: string[],
  scopeRows: AppointmentRow[] = rows
): DashboardMetrics {
  const totalSessions = rows.length;
  const patientSet = new Set(rows.map((r) => r.patient));
  const uniquePatients = patientSet.size;

  const shown = rows.filter((r) => r.showUp !== null);
  const showUpRate = shown.length > 0 ? shown.filter((r) => r.showUp).length / shown.length : null;

  // Title/session-type breakdown per month (stacked series, capped).
  const titleTotals = new Map<string, number>();
  for (const row of rows) titleTotals.set(row.title, (titleTotals.get(row.title) ?? 0) + 1);
  const keptTitles = new Set(topCategories(titleTotals, MAX_SERIES).keys());
  const seriesKeys = Array.from(keptTitles);

  const byMonth = new Map<string, MonthlySeriesPoint>();
  for (const m of months) {
    const point: MonthlySeriesPoint = { month: m, label: monthLabel(m), total: 0 };
    for (const key of seriesKeys) point[key] = 0;
    byMonth.set(m, point);
  }
  for (const row of rows) {
    const m = monthKey(row.scheduledFor);
    const point = byMonth.get(m);
    if (!point) continue;
    const seriesKey = keptTitles.has(row.title) ? row.title : OTHER_LABEL;
    point[seriesKey] = ((point[seriesKey] as number) ?? 0) + 1;
    point.total = (point.total as number) + 1;
  }
  const sessionsByMonth = months.map((m) => byMonth.get(m)!);

  // New patients: first-ever appointment (within scopeRows) falling in this month.
  const firstAppt = firstAppointmentByPatient(scopeRows);
  const newPatientCounts = new Map<string, number>();
  for (const [, date] of firstAppt) {
    const m = monthKey(date);
    newPatientCounts.set(m, (newPatientCounts.get(m) ?? 0) + 1);
  }
  const newPatientsByMonth = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    count: newPatientCounts.get(m) ?? 0,
  }));
  const newPatients = newPatientsByMonth.reduce((sum, p) => sum + p.count, 0);

  // Cumulative growth curve, seeded with patients who joined before the visible range.
  const priorPatients = Array.from(firstAppt.values()).filter(
    (d) => months.length === 0 || monthKey(d) < months[0]
  ).length;
  let running = priorPatients;
  const cumulativePatients = months.map((m) => {
    running += newPatientCounts.get(m) ?? 0;
    return { month: m, label: monthLabel(m), total: running };
  });

  const accountCounts = new Map<string, number>();
  for (const row of rows) {
    const label = accountLabel(row.account);
    accountCounts.set(label, (accountCounts.get(label) ?? 0) + 1);
  }
  const accountMix = Array.from(topCategories(accountCounts, MAX_BAR_CATEGORIES).entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Exclude the current (and any future) month from the trend — appointment data
  // routinely includes upcoming scheduled visits, so an in-progress month reads
  // as a misleading drop-off next to a completed one.
  const completeMonthKeys = new Set(excludeCurrentMonth(months));
  const completeMonths = sessionsByMonth.filter((m) => completeMonthKeys.has(m.month));
  const lastTwo = completeMonths.slice(-2);
  const momGrowthPct =
    lastTwo.length === 2 && lastTwo[0].total > 0
      ? ((lastTwo[1].total as number) - (lastTwo[0].total as number)) / (lastTwo[0].total as number)
      : null;

  const revenue = totalSessions * REVENUE_PER_SESSION;
  const revenueByMonth = sessionsByMonth.map((m) => ({
    month: m.month,
    label: m.label,
    revenue: (m.total as number) * REVENUE_PER_SESSION,
  }));

  return {
    totalSessions,
    uniquePatients,
    newPatients,
    showUpRate,
    months,
    sessionsByMonth,
    seriesKeys,
    newPatientsByMonth,
    cumulativePatients,
    accountMix,
    momGrowthPct,
    revenue,
    revenueByMonth,
  };
}

/** Share of total sessions each month that belong to `accountRows`, computed against `allRows`. */
export function computeShareOfTotal(
  accountRows: AppointmentRow[],
  allRows: AppointmentRow[],
  months: string[]
): { month: string; label: string; sharePct: number }[] {
  const accountByMonth = new Map<string, number>();
  for (const row of accountRows) {
    const m = monthKey(row.scheduledFor);
    accountByMonth.set(m, (accountByMonth.get(m) ?? 0) + 1);
  }
  const totalByMonth = new Map<string, number>();
  for (const row of allRows) {
    const m = monthKey(row.scheduledFor);
    totalByMonth.set(m, (totalByMonth.get(m) ?? 0) + 1);
  }
  return months.map((m) => {
    const total = totalByMonth.get(m) ?? 0;
    const account = accountByMonth.get(m) ?? 0;
    return { month: m, label: monthLabel(m), sharePct: total > 0 ? (account / total) * 100 : 0 };
  });
}
