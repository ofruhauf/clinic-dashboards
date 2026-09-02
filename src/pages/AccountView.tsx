import { useMemo, type ReactNode } from 'react';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import CustomizeStatsButton from '../components/CustomizeStatsButton';
import SessionsByMonthChart from '../components/charts/SessionsByMonthChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  BOOKED_SERIES_LABEL,
  computeBookedByMonth,
  computeBookedPipeline,
  computeCumulativeRegisteredPatients,
  computeMetrics,
  filterByRange,
  monthsForRange,
  resolveDateRange,
  type MonthlySeriesPoint,
} from '../lib/metrics';
import type { AppointmentRow, BookedSessionRow, DateRangePreset, RegisteredPatientRow } from '../lib/types';
import { SERIES_COLORS } from '../lib/theme';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';
import { useStatVisibility } from '../lib/useStatVisibility';

interface AccountViewProps {
  rows: AppointmentRow[];
  registeredPatients: RegisteredPatientRow[];
  bookedSessions: BookedSessionRow[];
  account: string;
  preset: DateRangePreset;
}

export default function AccountView({ rows, registeredPatients, bookedSessions, account, preset }: AccountViewProps) {
  const accountRows = useMemo(() => rows.filter((r) => r.account === account), [rows, account]);
  const registeredForAccount = useMemo(
    () => registeredPatients.filter((p) => p.company === account),
    [registeredPatients, account]
  );
  const registeredCount = registeredForAccount.length;

  const range = useMemo(() => resolveDateRange(preset, accountRows), [preset, accountRows]);
  const filtered = useMemo(() => filterByRange(accountRows, range), [accountRows, range]);
  const months = useMemo(() => monthsForRange(accountRows, range), [accountRows, range]);
  const metrics = useMemo(() => computeMetrics(filtered, months, accountRows), [filtered, months, accountRows]);

  // Registered-patient growth — the primary patient-growth metric (registered,
  // not billed/active). Only patients with a parseable registration date can be
  // placed on the timeline; the rest still count toward the raw total elsewhere.
  const datedRegistered = useMemo(
    () => registeredForAccount.filter((p): p is typeof p & { registeredAt: Date } => p.registeredAt != null),
    [registeredForAccount]
  );
  const registeredGrowth = useMemo(
    () => computeCumulativeRegisteredPatients(datedRegistered, months),
    [datedRegistered, months]
  );

  const bookedForAccount = useMemo(
    () => bookedSessions.filter((b) => b.account === account),
    [bookedSessions, account]
  );
  const bookedPipeline = useMemo(() => computeBookedPipeline(bookedForAccount), [bookedForAccount]);

  // Forward-looking monthly breakdown of the same booked pipeline, appended
  // as a visually-distinct tail to the sessions/revenue/patients charts
  // below — never merged into the actual historical series, since it comes
  // from a different system (the scheduling CRM) and nothing in it has
  // happened or been billed yet.
  const bookedByMonth = useMemo(() => computeBookedByMonth(bookedForAccount), [bookedForAccount]);

  const sessionsByMonthWithProjection = useMemo(() => {
    if (bookedByMonth.length === 0) return metrics.sessionsByMonth;
    const existingMonths = new Set(metrics.sessionsByMonth.map((p) => p.month));
    const projectedPoints: MonthlySeriesPoint[] = bookedByMonth
      .filter((b) => !existingMonths.has(b.month))
      .map((b) => {
        const point: MonthlySeriesPoint = { month: b.month, label: b.label, total: b.sessionCount };
        for (const key of metrics.seriesKeys) point[key] = 0;
        point[BOOKED_SERIES_LABEL] = b.sessionCount;
        return point;
      });
    return [...metrics.sessionsByMonth, ...projectedPoints];
  }, [metrics.sessionsByMonth, metrics.seriesKeys, bookedByMonth]);

  const revenueByMonthWithProjection = useMemo(() => {
    if (bookedByMonth.length === 0) return metrics.revenueByMonth;
    const existingMonths = new Set(metrics.revenueByMonth.map((p) => p.month));
    const projectedPoints = bookedByMonth
      .filter((b) => !existingMonths.has(b.month))
      .map((b) => ({ month: b.month, label: b.label, revenue: 0, [BOOKED_SERIES_LABEL]: b.projectedRevenue }));
    return [...metrics.revenueByMonth, ...projectedPoints];
  }, [metrics.revenueByMonth, bookedByMonth]);

  const newPatientsByMonthWithProjection = useMemo(() => {
    if (bookedByMonth.length === 0) return metrics.newPatientsByMonth;
    const existingMonths = new Set(metrics.newPatientsByMonth.map((p) => p.month));
    const projectedPoints = bookedByMonth
      .filter((b) => !existingMonths.has(b.month))
      .map((b) => ({ month: b.month, label: b.label, count: 0, [BOOKED_SERIES_LABEL]: b.uniquePatients }));
    return [...metrics.newPatientsByMonth, ...projectedPoints];
  }, [metrics.newPatientsByMonth, bookedByMonth]);

  const { hidden, toggle } = useStatVisibility('account');

  const statCards = useMemo(() => {
    const cards: { key: string; label: string; node: ReactNode }[] = [];

    if (registeredCount > 0) {
      cards.push({
        key: 'registeredPatients',
        label: 'Registered patients',
        node: <KpiCard label={`Registered ${account} patients`} value={registeredCount.toLocaleString()} />,
      });
    }
    cards.push({
      key: 'patients',
      label: 'Patients treated',
      node: <KpiCard label="Patients treated" value={metrics.uniquePatients.toLocaleString()} />,
    });
    cards.push({
      key: 'sessions',
      label: 'Sessions',
      node: <KpiCard label={`${account} sessions`} value={metrics.totalSessions.toLocaleString()} />,
    });
    cards.push({
      key: 'revenue',
      label: 'Revenue',
      node: <KpiCard label={`${account} revenue`} value={formatCurrency(metrics.revenue)} />,
    });
    if (bookedForAccount.length > 0) {
      cards.push({
        key: 'bookedPipeline',
        label: 'Booked sessions (upcoming)',
        node: (
          <KpiCard
            label="Booked sessions (upcoming)"
            value={bookedPipeline.upcomingCount.toLocaleString()}
            sub={`${bookedPipeline.uniquePatients.toLocaleString()} patient${bookedPipeline.uniquePatients === 1 ? '' : 's'} · ~${formatCurrency(bookedPipeline.projectedRevenue)} projected (est. $140/session)`}
          />
        ),
      });
    }
    cards.push({
      key: 'newPatients',
      label: 'New patients',
      node: <KpiCard label="New patients" value={metrics.newPatients.toLocaleString()} />,
    });
    cards.push({
      key: 'showUpRate',
      label: 'Show-up rate',
      node: (
        <KpiCard
          label="Show-up rate"
          value={metrics.showUpRate == null ? '—' : `${Math.round(metrics.showUpRate * 100)}%`}
        />
      ),
    });
    return cards;
  }, [account, metrics, registeredCount, bookedForAccount, bookedPipeline]);

  if (accountRows.length === 0) {
    return (
      <p style={{ color: '#898781', fontSize: 14 }}>
        No sessions found for <strong>{account}</strong> in the uploaded data.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CustomizeStatsButton
          options={statCards.map(({ key, label }) => ({ key, label }))}
          hidden={hidden}
          onToggle={toggle}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {statCards
          .filter((card) => !hidden.includes(card.key))
          .map((card) => (
            <div key={card.key}>{card.node}</div>
          ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: datedRegistered.length > 0 ? '1fr 1fr' : '1fr',
          gap: 16,
        }}
      >
        <ChartCard
          title={`${account} sessions by month`}
          subtitle={bookedByMonth.length > 0 ? 'By visit type · dashed bars are upcoming booked sessions' : 'By visit type'}
        >
          <SessionsByMonthChart
            data={sessionsByMonthWithProjection}
            seriesKeys={metrics.seriesKeys}
            projectedKey={bookedByMonth.length > 0 ? BOOKED_SERIES_LABEL : undefined}
          />
        </ChartCard>
        {datedRegistered.length > 0 && (
          <ChartCard title="Registered patient growth" subtitle={`Running total of registered ${account} patients`}>
            <SimpleLineChart data={registeredGrowth} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
          </ChartCard>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ChartCard
          title="Revenue by month"
          subtitle={
            bookedByMonth.length > 0
              ? 'Actual billed amount · dashed bars are projected revenue from upcoming bookings (est. $140/session)'
              : 'Actual billed amount'
          }
        >
          <SimpleBarChart
            data={revenueByMonthWithProjection}
            xKey="label"
            yKey="revenue"
            color={SERIES_COLORS[1]}
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
            actualLabel="Billed"
            projected={bookedByMonth.length > 0 ? { key: BOOKED_SERIES_LABEL, label: BOOKED_SERIES_LABEL } : undefined}
          />
        </ChartCard>
        <ChartCard
          title="New patients per month"
          subtitle={
            bookedByMonth.length > 0
              ? 'Dashed bars are patients with an upcoming booking (pipeline, not necessarily new)'
              : undefined
          }
        >
          <SimpleBarChart
            data={newPatientsByMonthWithProjection}
            xKey="label"
            yKey="count"
            color={SERIES_COLORS[1]}
            actualLabel="New patients"
            projected={bookedByMonth.length > 0 ? { key: BOOKED_SERIES_LABEL, label: BOOKED_SERIES_LABEL } : undefined}
          />
        </ChartCard>
        <ChartCard
          title="Active (billed) patient growth"
          subtitle={`Running total of ${account} patients seen/billed`}
        >
          <SimpleLineChart data={metrics.cumulativePatients} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
        </ChartCard>
      </div>
    </div>
  );
}
