import type { AppointmentRow, DateRange } from './types';
import {
  computeMetrics,
  excludeCurrentMonth,
  filterByRange,
  lastNMonthsRange,
  latestDate,
  monthKey,
  monthLabel,
  monthsForRange,
  resolveDateRange,
} from './metrics';
import { SERIES_COLORS } from './theme';
import { formatCurrency, formatCurrencyCompact } from './format';

type MetricKey = 'sessions' | 'revenue' | 'newPatients' | 'uniquePatients' | 'showUpRate' | 'cumulativePatients';

const METRIC_LABELS: Record<MetricKey, string> = {
  sessions: 'sessions',
  revenue: 'revenue',
  newPatients: 'new patients',
  uniquePatients: 'active patients',
  showUpRate: 'show-up rate',
  cumulativePatients: 'cumulative patients',
};

export interface QueryChartPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface QueryChart {
  kind: 'bar' | 'line';
  points: QueryChartPoint[];
  color: string;
  formatValue: (v: number) => string;
  tickFormatter?: (v: number) => string;
}

export interface QueryAnswer {
  question: string;
  headline: string;
  detail: string;
  scopeLabel: string;
  chart?: QueryChart;
  understood: boolean;
}

export interface QueryContext {
  allRows: AppointmentRow[];
  accounts: { name: string; sessions: number }[];
  /** null = clinic-wide (the Overview page's default scope) */
  defaultAccount: string | null;
  defaultRange: DateRange;
  defaultRangeLabel: string;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKey(d);
}

function monthKeyStart(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function monthKeyEnd(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59));
}

function parseMetric(text: string): { key: MetricKey; isGrowth: boolean } {
  const isGrowth = /\bgrowth\b|\bmom\b|month[- ]over[- ]month/i.test(text);

  let key: MetricKey = 'sessions';
  if (/\bnew\s+patients?\b/i.test(text)) key = 'newPatients';
  else if (/show[- ]?up|no[- ]?show|attendance/i.test(text)) key = 'showUpRate';
  else if (/\brevenue\b|\bincome\b|\bearnings\b/i.test(text)) key = 'revenue';
  else if (/\bcumulative\b|running total/i.test(text)) key = 'cumulativePatients';
  else if (/\bunique\s+patients?\b|\btotal\s+patients?\b|\bpatients?\b/i.test(text)) key = 'uniquePatients';
  else if (/\bsessions?\b|\bvisits?\b|\bappointments?\b/i.test(text)) key = 'sessions';

  return { key, isGrowth };
}

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};
const MONTH_NAME_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s*(\d{4})?/i;

interface TimeParse {
  range: DateRange;
  label: string;
}

function parseTimeRange(text: string, rows: AppointmentRow[]): TimeParse | null {
  const lastN = text.match(/last\s+(\d+)\s+months?/i);
  if (lastN) {
    const n = Math.max(1, parseInt(lastN[1], 10));
    return { range: lastNMonthsRange(n, rows), label: `last ${n} month${n === 1 ? '' : 's'}` };
  }

  if (/\bytd\b|year to date|\bthis year\b/i.test(text)) {
    return { range: resolveDateRange('ytd', rows), label: 'year to date' };
  }

  if (/\ball\s*(time|data)\b|since (the )?(beginning|inception)|\beverything\b/i.test(text)) {
    return { range: { start: null, end: null }, label: 'all time' };
  }

  const latest = latestDate(rows);
  if (latest) {
    if (/\bthis month\b/i.test(text)) {
      const key = monthKey(latest);
      return { range: { start: monthKeyStart(key), end: monthKeyEnd(key) }, label: 'this month' };
    }
    if (/\blast month\b/i.test(text)) {
      const key = shiftMonthKey(monthKey(latest), -1);
      return { range: { start: monthKeyStart(key), end: monthKeyEnd(key) }, label: 'last month' };
    }
  }

  const monthMatch = text.match(MONTH_NAME_PATTERN);
  if (monthMatch) {
    const monthIdx = MONTH_LOOKUP[monthMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      let year = monthMatch[2] ? parseInt(monthMatch[2], 10) : null;
      if (year === null) {
        const allMonths = monthsForRange(rows, { start: null, end: null });
        const candidates = allMonths.filter((m) => Number(m.split('-')[1]) === monthIdx + 1);
        year = candidates.length > 0 ? Number(candidates[candidates.length - 1].split('-')[0]) : latest?.getUTCFullYear() ?? new Date().getUTCFullYear();
      }
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      return { range: { start: monthKeyStart(key), end: monthKeyEnd(key) }, label: monthLabel(key) };
    }
  }

  return null;
}

function parseAccount(text: string, accounts: { name: string }[]): { explicit: boolean; account: string | null } {
  if (/\bclinic\b|\ball accounts\b|\boverall\b/i.test(text)) {
    return { explicit: true, account: null };
  }
  const byLength = [...accounts].sort((a, b) => b.name.length - a.name.length);
  for (const a of byLength) {
    if (text.toLowerCase().includes(a.name.toLowerCase())) {
      return { explicit: true, account: a.name };
    }
  }
  return { explicit: false, account: null };
}

function activePatientsByMonth(rows: AppointmentRow[], months: string[]): QueryChartPoint[] {
  const monthSet = new Set(months);
  const byMonth = new Map<string, Set<string>>();
  for (const row of rows) {
    const m = monthKey(row.scheduledFor);
    if (!monthSet.has(m)) continue;
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m)!.add(row.patientId);
  }
  return months.map((m) => ({ label: monthLabel(m), value: byMonth.get(m)?.size ?? 0 }));
}

function showUpRateByMonth(rows: AppointmentRow[], months: string[]): QueryChartPoint[] {
  const monthSet = new Set(months);
  const byMonth = new Map<string, { yes: number; known: number }>();
  for (const row of rows) {
    if (row.showUp === null) continue;
    const m = monthKey(row.scheduledFor);
    if (!monthSet.has(m)) continue;
    const entry = byMonth.get(m) ?? { yes: 0, known: 0 };
    entry.known += 1;
    if (row.showUp) entry.yes += 1;
    byMonth.set(m, entry);
  }
  return months.map((m) => {
    const entry = byMonth.get(m);
    return { label: monthLabel(m), value: entry && entry.known > 0 ? Math.round((entry.yes / entry.known) * 100) : 0 };
  });
}

const percentFormat = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`;
const countFormat = (v: number) => Math.round(v).toLocaleString();
const rateFormat = (v: number) => `${Math.round(v)}%`;

export function answerQuery(question: string, ctx: QueryContext): QueryAnswer {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      question: trimmed,
      headline: 'Type a question about your data.',
      detail: '',
      scopeLabel: '',
      understood: false,
    };
  }

  const { key: metricKey, isGrowth } = parseMetric(trimmed);
  const accountParse = parseAccount(trimmed, ctx.accounts);
  const account = accountParse.explicit ? accountParse.account : ctx.defaultAccount;
  const scopeRows = account ? ctx.allRows.filter((r) => r.account === account) : ctx.allRows;

  const timeParse = parseTimeRange(trimmed, scopeRows.length > 0 ? scopeRows : ctx.allRows);
  const range = timeParse ? timeParse.range : ctx.defaultRange;
  const rangeLabel = timeParse ? timeParse.label : ctx.defaultRangeLabel;

  let months = monthsForRange(scopeRows, range);
  if (isGrowth) {
    months = excludeCurrentMonth(months);
    // A growth question needs at least two complete months to compare. The
    // requested window may not have that many once the in-progress trailing
    // month is dropped (e.g. a young account's "last 3 months" mostly falls
    // in the current month) — widen step by step rather than dead-ending.
    for (const n of [6, 12, 24, 60]) {
      if (months.length >= 2) break;
      months = excludeCurrentMonth(monthsForRange(scopeRows, lastNMonthsRange(n, scopeRows)));
    }
  }

  const trimmedRange: DateRange =
    months.length > 0 ? { start: monthKeyStart(months[0]), end: monthKeyEnd(months[months.length - 1]) } : range;
  const windowRows = filterByRange(scopeRows, trimmedRange);
  const metrics = computeMetrics(windowRows, months, scopeRows);

  const color = account ? SERIES_COLORS[1] : SERIES_COLORS[0];
  const resolvedRangeLabel =
    isGrowth && months.length > 0
      ? months.length === 1
        ? monthLabel(months[0])
        : `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}`
      : rangeLabel;
  const scopeLabel = `${account ?? 'Clinic-wide'} • ${resolvedRangeLabel}`;

  let points: QueryChartPoint[];
  let overallValue: number | null;
  let formatValue: (v: number) => string;
  let tickFormatter: ((v: number) => string) | undefined;

  switch (metricKey) {
    case 'revenue':
      points = metrics.revenueByMonth.map((p) => ({ label: p.label, value: p.revenue }));
      overallValue = metrics.revenue;
      formatValue = formatCurrency;
      tickFormatter = formatCurrencyCompact;
      break;
    case 'newPatients':
      points = metrics.newPatientsByMonth.map((p) => ({ label: p.label, value: p.count }));
      overallValue = metrics.newPatients;
      formatValue = countFormat;
      break;
    case 'cumulativePatients':
      points = metrics.cumulativePatients.map((p) => ({ label: p.label, value: p.total }));
      overallValue = points.length > 0 ? points[points.length - 1].value : metrics.uniquePatients;
      formatValue = countFormat;
      break;
    case 'uniquePatients':
      points = activePatientsByMonth(windowRows, months);
      overallValue = metrics.uniquePatients;
      formatValue = countFormat;
      break;
    case 'showUpRate':
      points = showUpRateByMonth(windowRows, months);
      overallValue = metrics.showUpRate == null ? null : Math.round(metrics.showUpRate * 100);
      formatValue = rateFormat;
      break;
    case 'sessions':
    default:
      points = metrics.sessionsByMonth.map((p) => ({ label: p.label, value: p.total as number }));
      overallValue = metrics.totalSessions;
      formatValue = countFormat;
      break;
  }

  if (isGrowth) {
    const deltas: (number | null)[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1].value;
      const cur = points[i].value;
      deltas.push(prev > 0 ? ((cur - prev) / prev) * 100 : null);
    }

    if (deltas.length === 0) {
      return {
        question: trimmed,
        headline: 'Not enough data',
        detail: `Need at least two months of ${METRIC_LABELS[metricKey]} data to compute growth for this scope.`,
        scopeLabel,
        understood: true,
      };
    }

    const deltaPoints: QueryChartPoint[] = points.slice(1).map((p, i) => ({ label: p.label, value: deltas[i] ?? 0 }));
    const latestDelta = deltas[deltas.length - 1];
    const headline = latestDelta == null ? '—' : percentFormat(latestDelta);
    const detail = points
      .slice(1)
      .map((p, i) => `${points[i].label} → ${p.label}: ${deltas[i] == null ? 'n/a' : percentFormat(deltas[i]!)}`)
      .join('   ·   ');

    return {
      question: trimmed,
      headline: `${headline} month-over-month`,
      detail,
      scopeLabel: `${scopeLabel} — ${METRIC_LABELS[metricKey]} growth`,
      chart: { kind: 'bar', points: deltaPoints, color, formatValue: percentFormat },
      understood: true,
    };
  }

  const headline = overallValue == null ? 'No data' : formatValue(overallValue);
  const detail =
    points.length > 1
      ? `${METRIC_LABELS[metricKey]} across ${points.length} months`
      : points.length === 1
        ? points[0].label
        : 'No appointments in this range';

  return {
    question: trimmed,
    headline,
    detail,
    scopeLabel: `${scopeLabel} — ${METRIC_LABELS[metricKey]}`,
    chart: points.length > 1 ? { kind: 'bar', points, color, formatValue, tickFormatter } : undefined,
    understood: true,
  };
}

// Re-exported for the UI layer's example chips / placeholder copy.
export const EXAMPLE_QUERIES = [
  'What is last 3 months MoM growth?',
  'Revenue last 6 months',
  'New patients this year',
  'Horizon revenue this year',
];

