import { useMemo } from 'react';
import ChartCard from '../components/ChartCard';
import HeroStat from '../components/HeroStat';
import HeroAreaChart from '../components/charts/HeroAreaChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  REVENUE_PER_SESSION,
  computeMetrics,
  computeShareOfTotal,
  excludeCurrentMonth,
  monthsForRange,
} from '../lib/metrics';
import type { AppointmentRow } from '../lib/types';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';

interface InvestorViewProps {
  rows: AppointmentRow[];
  account: string;
}

const ACCENT = '#eb6834';
const COMPARE_MONTHS_BACK = 3;

// Official partnership start per account, when it differs from the first
// row in the data (e.g. a pre-launch pilot session). Story stats and charts
// are anchored here; sessions before this date are noted but not counted.
// Add more accounts here as needed.
const ACCOUNT_LAUNCH_DATES: Record<string, string> = {
  horizon: '2026-06-01',
};

export default function InvestorView({ rows, account }: InvestorViewProps) {
  const launchDate = ACCOUNT_LAUNCH_DATES[account.toLowerCase()];
  const launchCutoff = useMemo(() => (launchDate ? new Date(`${launchDate}T00:00:00Z`) : null), [launchDate]);

  const allAccountRows = useMemo(() => rows.filter((r) => r.account === account), [rows, account]);
  const accountRows = useMemo(
    () => (launchCutoff ? allAccountRows.filter((r) => r.scheduledFor >= launchCutoff) : allAccountRows),
    [allAccountRows, launchCutoff]
  );
  const preLaunchCount = allAccountRows.length - accountRows.length;

  // Always the account's full trajectory since launch, through now — a pitch
  // view isn't meant to be filtered, it's meant to tell the whole story.
  const months = useMemo(() => monthsForRange(accountRows, { start: null, end: null }), [accountRows]);
  const metrics = useMemo(() => computeMetrics(accountRows, months, accountRows), [accountRows, months]);
  const share = useMemo(() => computeShareOfTotal(accountRows, rows, months), [accountRows, rows, months]);

  const stats = useMemo(() => {
    const completeMonths = excludeCurrentMonth(months);
    const referenceMonths = completeMonths.length > 0 ? completeMonths : months;
    if (referenceMonths.length === 0 || months.length === 0) return null;

    const lastKey = referenceMonths[referenceMonths.length - 1];
    const lastSessions = metrics.sessionsByMonth.find((p) => p.month === lastKey);
    const lastRevenue = metrics.revenueByMonth.find((p) => p.month === lastKey);

    const compareIdx = Math.max(0, referenceMonths.length - 1 - COMPARE_MONTHS_BACK);
    const compareKey = referenceMonths[compareIdx];
    const actualMonthsBack = referenceMonths.length - 1 - compareIdx;
    const compareSessions = metrics.sessionsByMonth.find((p) => p.month === compareKey);

    const growthMultiple =
      actualMonthsBack > 0 && compareSessions && (compareSessions.total as number) > 0 && lastSessions
        ? (lastSessions.total as number) / (compareSessions.total as number)
        : null;

    const firstPoint = metrics.sessionsByMonth[0];
    const monthsSinceFirst = months.indexOf(lastKey) + 1;

    let running = 0;
    const cumulativeRevenue = metrics.revenueByMonth.map((p) => {
      running += p.revenue;
      return { month: p.month, label: p.label, value: running };
    });

    return {
      lastKey,
      lastLabel: lastSessions?.label ?? firstPoint.label,
      lastSessionsCount: (lastSessions?.total as number) ?? firstPoint.total,
      arrRunRate: lastRevenue ? lastRevenue.revenue * 12 : null,
      growthMultiple,
      compareLabel: compareSessions?.label ?? firstPoint.label,
      actualMonthsBack,
      firstLabel: firstPoint.label,
      firstCount: firstPoint.total as number,
      monthsSinceFirst,
      cumulativeRevenue,
    };
  }, [metrics, months]);

  if (accountRows.length === 0 || !stats) {
    return (
      <p style={{ color: '#898781', fontSize: 14 }}>
        Not enough <strong>{account}</strong> data yet to build an investor view.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {account} × Agave Health
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: '#0b0b0b', marginTop: 4 }}>
          From {stats.firstCount} session{stats.firstCount === 1 ? '' : 's'} in {stats.firstLabel} to{' '}
          {stats.lastSessionsCount} in {stats.lastLabel}
        </h2>
        {stats.growthMultiple != null && (
          <p style={{ fontSize: 16, color: '#52514e', marginTop: 4 }}>
            <strong style={{ color: '#0b0b0b' }}>{stats.growthMultiple.toFixed(1)}x</strong> session growth over the
            last {stats.actualMonthsBack} month{stats.actualMonthsBack === 1 ? '' : 's'} (
            {stats.compareLabel} → {stats.lastLabel}).
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <HeroStat
          label="ARR run-rate"
          value={stats.arrRunRate == null ? '—' : formatCurrency(stats.arrRunRate)}
          sub={`Based on ${stats.lastLabel} pace`}
          accent={ACCENT}
        />
        <HeroStat
          label="Session growth"
          value={stats.growthMultiple == null ? '—' : `${stats.growthMultiple.toFixed(1)}x`}
          sub={`vs. ${stats.actualMonthsBack} month${stats.actualMonthsBack === 1 ? '' : 's'} earlier`}
          accent={ACCENT}
        />
        <HeroStat
          label="Revenue to date"
          value={formatCurrency(metrics.revenue)}
          sub={`${metrics.totalSessions.toLocaleString()} sessions · ${metrics.uniquePatients.toLocaleString()} patients`}
          accent={ACCENT}
        />
        <HeroStat
          label="Time to traction"
          value={`${stats.monthsSinceFirst} mo`}
          sub={`Since first session in ${stats.firstLabel}`}
          accent={ACCENT}
        />
      </div>

      <ChartCard title="Cumulative revenue" subtitle={`${account} · ${stats.firstLabel} – ${stats.lastLabel}`} height={340}>
        <HeroAreaChart
          data={stats.cumulativeRevenue}
          xKey="label"
          yKey="value"
          color={ACCENT}
          gradientId="investorHero"
          valueFormatter={formatCurrency}
          tickFormatter={formatCurrencyCompact}
        />
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Monthly revenue" subtitle="Recent momentum">
          <SimpleBarChart
            data={metrics.revenueByMonth}
            xKey="label"
            yKey="revenue"
            color={ACCENT}
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
          />
        </ChartCard>
        <ChartCard title="Share of clinic volume" subtitle={`${account} as % of all sessions — growing, not cannibalizing`}>
          <SimpleLineChart
            data={share}
            xKey="label"
            yKey="sharePct"
            color={ACCENT}
            valueFormatter={(v) => `${v.toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      <p style={{ fontSize: 11.5, color: '#898781', borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 12 }}>
        As of {stats.lastLabel} · {metrics.totalSessions.toLocaleString()} total sessions ·{' '}
        {metrics.uniquePatients.toLocaleString()} patients · Source: Agave Health scheduling export. Revenue is
        estimated at a flat ${REVENUE_PER_SESSION}/session (no billing data in the export) — illustrative, not billed
        revenue.
        {launchDate && (
          <>
            {' '}
            Figures reflect the official {account} launch on {launchDate}
            {preLaunchCount > 0
              ? ` — excludes ${preLaunchCount} pre-launch pilot session${preLaunchCount === 1 ? '' : 's'}.`
              : '.'}
          </>
        )}
      </p>
    </div>
  );
}
