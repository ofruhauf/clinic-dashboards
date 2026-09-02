import { useMemo, type ReactNode } from 'react';
import ChartCard from '../components/ChartCard';
import HeroStat from '../components/HeroStat';
import CustomizeStatsButton from '../components/CustomizeStatsButton';
import HeroAreaChart from '../components/charts/HeroAreaChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  addMonths,
  computeBookedPipeline,
  computeCumulativeRegisteredPatients,
  computeMetrics,
  computeShareOfTotal,
  excludeCurrentMonth,
  monthLabel,
  monthsForRange,
} from '../lib/metrics';
import type { AppointmentRow, BookedSessionRow, RegisteredPatientRow } from '../lib/types';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';
import { useStatVisibility } from '../lib/useStatVisibility';

interface InvestorViewProps {
  rows: AppointmentRow[];
  registeredPatients: RegisteredPatientRow[];
  bookedSessions: BookedSessionRow[];
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

export default function InvestorView({ rows, registeredPatients, bookedSessions, account }: InvestorViewProps) {
  const accountKey = account.toLowerCase();
  const launchDate = ACCOUNT_LAUNCH_DATES[accountKey];
  const eoyArrTarget = ACCOUNT_EOY_ARR_TARGET[accountKey];
  const organicNote = ACCOUNT_ORGANIC_NOTE[accountKey];
  const launchCutoff = useMemo(() => (launchDate ? new Date(`${launchDate}T00:00:00Z`) : null), [launchDate]);
  const registeredForAccount = useMemo(
    () => registeredPatients.filter((p) => p.company === account),
    [registeredPatients, account]
  );
  const registeredCount = registeredForAccount.length;
  const datedRegistered = useMemo(
    () => registeredForAccount.filter((p): p is typeof p & { registeredAt: Date } => p.registeredAt != null),
    [registeredForAccount]
  );

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
  const registeredGrowth = useMemo(
    () => computeCumulativeRegisteredPatients(datedRegistered, months),
    [datedRegistered, months]
  );
  const bookedForAccount = useMemo(
    () => bookedSessions.filter((b) => b.account === account),
    [bookedSessions, account]
  );
  const bookedPipeline = useMemo(() => computeBookedPipeline(bookedForAccount), [bookedForAccount]);

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
      cumulativeRevenue,
      eoyProjection,
      avgRevenuePerPatient: metrics.uniquePatients > 0 ? metrics.revenue / metrics.uniquePatients : null,
    };
  }, [metrics, months, eoyArrTarget]);

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
            sub={`Based on ${stats.lastLabel} pace — actual billed revenue`}
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
            value={formatCurrency(metrics.revenue)}
            sub={`${metrics.totalSessions.toLocaleString()} sessions · ${metrics.uniquePatients.toLocaleString()} patients`}
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
            sub={`${metrics.uniquePatients.toLocaleString()} patients · still active, not a final lifetime figure`}
            accent={ACCENT}
          />
        ),
      },
    ];
    if (registeredCount > 0) {
      cards.push({
        key: 'registeredPatients',
        label: 'Registered patients',
        node: (
          <HeroStat
            label="Registered patients"
            value={registeredCount.toLocaleString()}
            sub={
              registeredCount > metrics.uniquePatients
                ? `${(registeredCount - metrics.uniquePatients).toLocaleString()} not yet booked — pipeline within ${account}`
                : `All registered ${account} patients have booked`
            }
            accent={ACCENT}
          />
        ),
      });
    }
    if (bookedForAccount.length > 0) {
      cards.push({
        key: 'bookedPipeline',
        label: 'Booked pipeline (upcoming)',
        node: (
          <HeroStat
            label="Booked pipeline (upcoming)"
            value={bookedPipeline.upcomingCount.toLocaleString()}
            sub={`${bookedPipeline.uniquePatients.toLocaleString()} patients · ~${formatCurrency(bookedPipeline.projectedRevenue)} projected (est. $140/session)`}
            accent={ACCENT}
          />
        ),
      });
    }
    return cards;
  }, [stats, metrics, registeredCount, account, bookedForAccount, bookedPipeline]);

  // A leading zero-value month makes both growth curves visibly start from
  // nothing rather than jumping in mid-climb — cosmetic only, not a claim
  // about activity in that month.
  // Anchored to one month before launch (not "one month before whichever
  // month real data happens to start"), so the lead-in reads as "before we
  // launched" rather than shifting around as historical data fills in.
  const leadInMonth = useMemo(
    () => (launchDate ? addMonths(launchDate.slice(0, 7), -1) : null),
    [launchDate]
  );

  const cumulativeRevenueChartData = useMemo(() => {
    const series = stats?.cumulativeRevenue ?? [];
    if (series.length === 0) return series;
    const priorMonth = leadInMonth ?? addMonths(series[0].month, -1);
    return [{ month: priorMonth, label: monthLabel(priorMonth), value: 0 }, ...series];
  }, [stats, leadInMonth]);

  const registeredGrowthChartData = useMemo(() => {
    if (registeredGrowth.length === 0) return registeredGrowth;
    const priorMonth = leadInMonth ?? addMonths(registeredGrowth[0].month, -1);
    return [{ month: priorMonth, label: monthLabel(priorMonth), total: 0 }, ...registeredGrowth];
  }, [registeredGrowth, leadInMonth]);

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
          gridTemplateColumns: registeredGrowthChartData.length > 0 ? '1fr 1fr' : '1fr',
          gap: 16,
        }}
      >
        <ChartCard
          title="Cumulative revenue"
          subtitle={`${account} · ${cumulativeRevenueChartData[0]?.label ?? stats.firstLabel} – ${stats.lastLabel}`}
        >
          <HeroAreaChart
            data={cumulativeRevenueChartData}
            xKey="label"
            yKey="value"
            color={ACCENT}
            gradientId="investorHero"
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
          />
        </ChartCard>
        {registeredGrowthChartData.length > 0 && (
          <ChartCard
            title="Registered patient growth"
            subtitle={`${account} · ${registeredGrowthChartData[0].label} – ${registeredGrowthChartData[registeredGrowthChartData.length - 1].label}`}
          >
            <SimpleLineChart data={registeredGrowthChartData} xKey="label" yKey="total" color={ACCENT} />
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
        {stats.avgRevenuePerPatient != null && (
          <>
            {' '}
            Patient LTV is total revenue to date ÷ unique patients — an average, not a per-patient lifetime figure,
            since {account} launched {launchDate ?? 'recently'} and most patients are still in active treatment.
          </>
        )}
        {registeredCount > 0 && (
          <>
            {' '}
            Registered patients comes from a separate product user database, not the claims/billing system, and
            uses its own patient IDs — the "not yet booked" figure is the difference between the two counts, not a
            per-patient match between systems.
          </>
        )}
        {bookedForAccount.length > 0 && (
          <>
            {' '}
            Booked pipeline comes from the scheduling CRM, not the claims/billing system — it counts upcoming,
            non-cancelled appointments as of today. Its projected revenue is an estimate at a flat $140/session, not
            actual billed amounts, since these sessions haven't happened (or been billed) yet.
          </>
        )}
      </p>
    </div>
  );
}
