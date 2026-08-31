import { useMemo } from 'react';
import ChartCard from '../components/ChartCard';
import HeroStat from '../components/HeroStat';
import HeroAreaChart from '../components/charts/HeroAreaChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import { computeMetrics, computeShareOfTotal, excludeCurrentMonth, monthsForRange } from '../lib/metrics';
import type { AppointmentRow } from '../lib/types';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';

interface InvestorViewProps {
  rows: AppointmentRow[];
  account: string;
}

const ACCENT = '#eb6834';
const COMPARE_MONTHS_BACK = 1; // true month-over-month, not a multi-month window

// Story-start date per account, when it differs from the first row in the
// data (e.g. a one-off pilot session before real ramp-up began). Story stats
// and charts are anchored here; sessions before this date are noted but not
// counted. Add more accounts here as needed.
const ACCOUNT_LAUNCH_DATES: Record<string, string> = {
  horizon: '2026-06-01',
};

// Year-end ARR target per account. Used only to compute and disclose the
// sustained month-over-month growth rate it implies from the latest known
// month — this is a stated goal with its assumption shown, not an
// independently derived forecast.
const ACCOUNT_EOY_ARR_TARGET: Record<string, number> = {
  horizon: 350000,
};

const ACCOUNT_ORGANIC_NOTE: Record<string, string> = {
  horizon:
    '100% organic — zero marketing spend. Growth is driven entirely by Horizon referrals and existing patient care flows.',
};

const PIPELINE_TARGETS = ['Highmark', 'BCBS NC', 'IDX'];
const PIPELINE_COVERED_LIVES = '15M+';

export default function InvestorView({ rows, account }: InvestorViewProps) {
  const accountKey = account.toLowerCase();
  const launchDate = ACCOUNT_LAUNCH_DATES[accountKey];
  const eoyArrTarget = ACCOUNT_EOY_ARR_TARGET[accountKey];
  const organicNote = ACCOUNT_ORGANIC_NOTE[accountKey];
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
    const compareRevenue = metrics.revenueByMonth.find((p) => p.month === compareKey);

    const revenueGrowthPct =
      actualMonthsBack > 0 && compareRevenue && compareRevenue.revenue > 0 && lastRevenue
        ? ((lastRevenue.revenue - compareRevenue.revenue) / compareRevenue.revenue) * 100
        : null;

    const firstPoint = metrics.sessionsByMonth[0];
    const monthsSinceFirst = months.indexOf(lastKey) + 1;

    let running = 0;
    const cumulativeRevenue = metrics.revenueByMonth.map((p) => {
      running += p.revenue;
      return { month: p.month, label: p.label, value: running };
    });

    // Year-end projection: the sustained MoM growth rate implied by getting
    // from the latest known month's revenue to the target ARR by December
    // of that same year. This is the target's assumption made visible, not
    // an independent forecast.
    let eoyProjection: { targetArr: number; impliedMonthlyGrowthPct: number } | null = null;
    if (eoyArrTarget && lastRevenue && lastRevenue.revenue > 0) {
      const lastMonthNum = Number(lastKey.split('-')[1]);
      const monthsRemaining = 12 - lastMonthNum;
      if (monthsRemaining > 0) {
        const targetMonthlyRevenue = eoyArrTarget / 12;
        const impliedMonthlyGrowthPct =
          (Math.pow(targetMonthlyRevenue / lastRevenue.revenue, 1 / monthsRemaining) - 1) * 100;
        eoyProjection = { targetArr: eoyArrTarget, impliedMonthlyGrowthPct };
      }
    }

    return {
      lastKey,
      lastYear: Number(lastKey.split('-')[0]),
      lastLabel: lastSessions?.label ?? firstPoint.label,
      lastSessionsCount: (lastSessions?.total as number) ?? firstPoint.total,
      lastRevenueValue: lastRevenue?.revenue ?? 0,
      arrRunRate: lastRevenue ? lastRevenue.revenue * 12 : null,
      revenueGrowthPct,
      compareLabel: compareRevenue?.label ?? firstPoint.label,
      compareRevenueValue: compareRevenue?.revenue ?? 0,
      actualMonthsBack,
      firstLabel: firstPoint.label,
      firstCount: firstPoint.total as number,
      monthsSinceFirst,
      cumulativeRevenue,
      eoyProjection,
    };
  }, [metrics, months, eoyArrTarget]);

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
        {stats.revenueGrowthPct != null && (
          <p style={{ fontSize: 16, color: '#52514e', marginTop: 4 }}>
            <strong style={{ color: '#0b0b0b' }}>
              {stats.revenueGrowthPct >= 0 ? '+' : ''}
              {stats.revenueGrowthPct.toFixed(0)}%
            </strong>{' '}
            revenue growth month-over-month ({stats.compareLabel} → {stats.lastLabel}):{' '}
            {formatCurrency(stats.compareRevenueValue)} → {formatCurrency(stats.lastRevenueValue)}.
          </p>
        )}
        {organicNote && (
          <p style={{ fontSize: 13, color: '#52514e', marginTop: 6, fontStyle: 'italic' }}>{organicNote}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <HeroStat
          label="ARR run-rate"
          value={stats.arrRunRate == null ? '—' : formatCurrency(stats.arrRunRate)}
          sub={`Based on ${stats.lastLabel} pace — actual billed revenue`}
          accent={ACCENT}
        />
        <HeroStat
          label="Revenue growth (MoM)"
          value={
            stats.revenueGrowthPct == null
              ? '—'
              : `${stats.revenueGrowthPct >= 0 ? '+' : ''}${stats.revenueGrowthPct.toFixed(0)}%`
          }
          sub={`${formatCurrency(stats.compareRevenueValue)} → ${formatCurrency(stats.lastRevenueValue)}`}
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

      {stats.eoyProjection && (
        <div
          style={{
            background: '#fff6f1',
            border: '1px solid rgba(235,104,52,0.3)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Projected · December {stats.lastYear}
          </p>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#0b0b0b', marginTop: 4, letterSpacing: -0.5 }}>
            ~{formatCurrency(stats.eoyProjection.targetArr)} ARR
          </p>
          <p style={{ fontSize: 13, color: '#52514e', marginTop: 4 }}>
            Implies {stats.eoyProjection.impliedMonthlyGrowthPct.toFixed(0)}% sustained month-over-month growth from{' '}
            {stats.lastLabel} through year-end
            {stats.revenueGrowthPct != null &&
              ` — below ${stats.lastLabel}'s actual +${stats.revenueGrowthPct.toFixed(0)}% pace`}
            .
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Monthly revenue" subtitle="Actual billed amount">
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

      <div
        style={{
          background: '#fcfcfb',
          border: '1px solid rgba(11,11,11,0.10)',
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0b0b0b' }}>The {account} playbook — ready to scale</h3>
        <p style={{ fontSize: 13.5, color: '#52514e', marginTop: 6, lineHeight: 1.5 }}>
          With {account} proving the model, Agave Health is expanding into a qualified pipeline of regional payers
          using the same onboarding and clinical workflow that took {account} from launch to scale.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {PIPELINE_TARGETS.map((name) => (
            <span
              key={name}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 999,
                background: '#fff6f1',
                color: ACCENT,
                border: '1px solid rgba(235,104,52,0.25)',
              }}
            >
              {name}
            </span>
          ))}
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 999,
              background: '#f0efec',
              color: '#0b0b0b',
            }}
          >
            {PIPELINE_COVERED_LIVES} covered lives
          </span>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: '#898781', borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 12 }}>
        As of {stats.lastLabel} · {metrics.totalSessions.toLocaleString()} total sessions ·{' '}
        {metrics.uniquePatients.toLocaleString()} patients · Source: Agave Health weekly claims reports. Revenue is
        the actual billed amount per claim — not an estimate.
        {launchDate && (
          <>
            {' '}
            Figures reflect {account} activity from {launchDate} (clinical ramp-up ahead of the formal contract
            start)
            {preLaunchCount > 0
              ? ` — excludes ${preLaunchCount} earlier pilot session${preLaunchCount === 1 ? '' : 's'}.`
              : '.'}
          </>
        )}
        {stats.eoyProjection && (
          <>
            {' '}
            The {formatCurrency(stats.eoyProjection.targetArr)} year-end ARR figure is a projection assuming{' '}
            {stats.eoyProjection.impliedMonthlyGrowthPct.toFixed(0)}% sustained month-over-month growth from{' '}
            {stats.lastLabel} through December {stats.lastYear} — a goal, not a guarantee.
          </>
        )}
      </p>
    </div>
  );
}
