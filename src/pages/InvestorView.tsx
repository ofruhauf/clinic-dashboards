import { useMemo, type ReactNode } from 'react';
import ChartCard from '../components/ChartCard';
import HeroStat from '../components/HeroStat';
import CustomizeStatsButton from '../components/CustomizeStatsButton';
import HeroAreaChart from '../components/charts/HeroAreaChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  computeEngagedGrowth,
  computeHorizonPeriodMetrics,
  computeRegisteredGrowth,
  countEngaged,
  countRegistered,
  excludeCurrentMonth,
} from '../lib/metrics';
import type { HorizonDataset } from '../lib/types';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';
import { useStatVisibility } from '../lib/useStatVisibility';

interface InvestorViewProps {
  dataset: HorizonDataset;
}

const ACCENT = '#eb6834';
const COMPARE_MONTHS_BACK = 1; // true month-over-month, not a multi-month window

// Year-end ARR target. Used only to compute and disclose the sustained
// month-over-month growth rate it implies from the latest known month —
// this is a stated goal with its assumption shown, not an independently
// derived forecast.
const EOY_ARR_TARGET = 350000;

const ORGANIC_NOTE =
  '100% organic — zero marketing spend. Growth is driven entirely by Horizon referrals and existing patient care flows.';

const PIPELINE_TARGETS = ['Highmark', 'BCBS NC', 'IDX'];
const PIPELINE_COVERED_LIVES = '15M+';

export default function InvestorView({ dataset }: InvestorViewProps) {
  // Always the account's full trajectory, through now — a pitch view isn't
  // meant to be filtered, it's meant to tell the whole story.
  const allMonths = dataset.months;
  const periodMetrics = useMemo(
    () => computeHorizonPeriodMetrics(dataset.users, allMonths),
    [dataset.users, allMonths]
  );
  const registeredGrowth = useMemo(
    () => computeRegisteredGrowth(dataset.users, allMonths),
    [dataset.users, allMonths]
  );
  const engagedGrowth = useMemo(
    () => computeEngagedGrowth(dataset.users, allMonths),
    [dataset.users, allMonths]
  );
  const registeredCount = useMemo(() => countRegistered(dataset.users), [dataset.users]);
  const engagedCount = useMemo(() => countEngaged(dataset.users), [dataset.users]);

  const stats = useMemo(() => {
    const completeMonths = excludeCurrentMonth(allMonths);
    const referenceMonths = completeMonths.length > 0 ? completeMonths : allMonths;
    if (referenceMonths.length === 0 || allMonths.length === 0) return null;

    const lastKey = referenceMonths[referenceMonths.length - 1];
    const lastSessions = periodMetrics.sessionsByMonth.find((p) => p.month === lastKey);
    const lastRevenue = periodMetrics.revenueByMonth.find((p) => p.month === lastKey);

    const compareIdx = Math.max(0, referenceMonths.length - 1 - COMPARE_MONTHS_BACK);
    const compareKey = referenceMonths[compareIdx];
    const actualMonthsBack = referenceMonths.length - 1 - compareIdx;
    const compareRevenue = periodMetrics.revenueByMonth.find((p) => p.month === compareKey);

    const revenueGrowthPct =
      actualMonthsBack > 0 && compareRevenue && compareRevenue.revenue > 0 && lastRevenue
        ? ((lastRevenue.revenue - compareRevenue.revenue) / compareRevenue.revenue) * 100
        : null;

    const firstPoint = periodMetrics.sessionsByMonth[0];

    let running = 0;
    const cumulativeRevenue = periodMetrics.revenueByMonth.map((p) => {
      running += p.revenue;
      return { month: p.month, label: p.label, value: running };
    });

    // Year-end projection: the sustained MoM growth rate implied by getting
    // from the latest known month's revenue to the target ARR by December
    // of that same year. This is the target's assumption made visible, not
    // an independent forecast.
    let eoyProjection: { targetArr: number; impliedMonthlyGrowthPct: number } | null = null;
    if (lastRevenue && lastRevenue.revenue > 0) {
      const lastMonthNum = Number(lastKey.split('-')[1]);
      const monthsRemaining = 12 - lastMonthNum;
      if (monthsRemaining > 0) {
        const targetMonthlyRevenue = EOY_ARR_TARGET / 12;
        const impliedMonthlyGrowthPct =
          (Math.pow(targetMonthlyRevenue / lastRevenue.revenue, 1 / monthsRemaining) - 1) * 100;
        eoyProjection = { targetArr: EOY_ARR_TARGET, impliedMonthlyGrowthPct };
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
      firstLabel: firstPoint.label,
      firstCount: firstPoint.total as number,
      cumulativeRevenue,
      eoyProjection,
      avgRevenuePerPatient: engagedCount > 0 ? periodMetrics.revenue / engagedCount : null,
    };
  }, [periodMetrics, allMonths, engagedCount]);

  const { hidden, toggle } = useStatVisibility('investor');

  const heroCards = useMemo(() => {
    if (!stats) return [];
    const cards: { key: string; label: string; node: ReactNode }[] = [
      {
        key: 'arrRunRate',
        label: 'ARR run-rate',
        node: (
          <HeroStat
            label="ARR run-rate"
            value={stats.arrRunRate == null ? '—' : formatCurrency(stats.arrRunRate)}
            sub={`Based on ${stats.lastLabel} pace`}
            accent={ACCENT}
          />
        ),
      },
      {
        key: 'revenueGrowth',
        label: 'Revenue growth (MoM)',
        node: (
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
        ),
      },
      {
        key: 'revenueToDate',
        label: 'Revenue to date',
        node: (
          <HeroStat
            label="Revenue to date"
            value={formatCurrency(periodMetrics.revenue)}
            sub={`${periodMetrics.totalSessions.toLocaleString()} sessions · ${engagedCount.toLocaleString()} patients`}
            accent={ACCENT}
          />
        ),
      },
      {
        key: 'patientLtv',
        label: 'Patient LTV (to date)',
        node: (
          <HeroStat
            label="Patient LTV (to date)"
            value={stats.avgRevenuePerPatient == null ? '—' : formatCurrency(stats.avgRevenuePerPatient)}
            sub={`${engagedCount.toLocaleString()} patients · still active, not a final lifetime figure`}
            accent={ACCENT}
          />
        ),
      },
      {
        key: 'registeredPatients',
        label: 'Registered patients',
        node: <HeroStat label="Registered patients" value={registeredCount.toLocaleString()} accent={ACCENT} />,
      },
    ];
    return cards;
  }, [stats, periodMetrics, engagedCount, registeredCount]);

  if (!stats) {
    return (
      <p style={{ color: '#898781', fontSize: 14 }}>Not enough data yet to build an investor view.</p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Horizon × Agave Health
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
        <p style={{ fontSize: 13, color: '#52514e', marginTop: 6, fontStyle: 'italic' }}>{ORGANIC_NOTE}</p>
      </div>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CustomizeStatsButton
          options={heroCards.map(({ key, label }) => ({ key, label }))}
          hidden={hidden}
          onToggle={toggle}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {heroCards
          .filter((card) => !hidden.includes(card.key))
          .map((card) => (
            <div key={card.key}>{card.node}</div>
          ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: registeredGrowth.length > 0 ? '1fr 1fr' : '1fr',
          gap: 16,
        }}
      >
        <ChartCard title="Cumulative revenue" subtitle={`Horizon · ${stats.firstLabel} – ${stats.lastLabel}`}>
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
        {registeredGrowth.length > 0 && (
          <ChartCard
            title="Registered patient growth"
            subtitle={`Horizon · ${registeredGrowth[0].label} – ${registeredGrowth[registeredGrowth.length - 1].label}`}
          >
            <SimpleLineChart data={registeredGrowth} xKey="label" yKey="total" color={ACCENT} />
          </ChartCard>
        )}
      </div>

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
        <ChartCard title="Monthly revenue" subtitle="Value recognized per the tracking workbook">
          <SimpleBarChart
            data={periodMetrics.revenueByMonth}
            xKey="label"
            yKey="revenue"
            color={ACCENT}
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
          />
        </ChartCard>
        <ChartCard title="Engaged (in-care) patient growth" subtitle="Running total of patients with a coaching or therapy session">
          <SimpleLineChart data={engagedGrowth} xKey="label" yKey="total" color={ACCENT} />
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
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0b0b0b' }}>The Horizon playbook — ready to scale</h3>
        <p style={{ fontSize: 13.5, color: '#52514e', marginTop: 6, lineHeight: 1.5 }}>
          With Horizon proving the model, Agave Health is expanding into a qualified pipeline of regional payers
          using the same onboarding and clinical workflow that took Horizon from launch to scale.
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
        As of {stats.lastLabel} · {periodMetrics.totalSessions.toLocaleString()} total sessions ·{' '}
        {engagedCount.toLocaleString()} patients treated · {registeredCount.toLocaleString()} registered · Source:
        Horizon D2C tracking workbook ("Users Tracking" tab). Revenue is the dollar value recognized in that
        workbook, not independently-verified insurance claims data.
        {stats.eoyProjection && (
          <>
            {' '}
            The {formatCurrency(stats.eoyProjection.targetArr)} year-end ARR figure is a projection assuming{' '}
            {stats.eoyProjection.impliedMonthlyGrowthPct.toFixed(0)}% sustained month-over-month growth from{' '}
            {stats.lastLabel} through December {stats.lastYear} — a goal, not a guarantee.
          </>
        )}
        {stats.avgRevenuePerPatient != null && (
          <>
            {' '}
            Patient LTV is total revenue to date ÷ patients treated — an average, not a per-patient lifetime figure,
            since most patients are still in active treatment.
          </>
        )}
      </p>
    </div>
  );
}
