import { useMemo, type ReactNode } from 'react';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import CustomizeStatsButton from '../components/CustomizeStatsButton';
import SessionsByMonthChart from '../components/charts/SessionsByMonthChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  computeBookedPipeline,
  computeCumulativeRegisteredPatients,
  computeMetrics,
  computeShareOfTotal,
  filterByRange,
  monthsForRange,
  resolveDateRange,
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
  // All-time, not date-range filtered — comparing a registered total (which isn't
  // date-scoped) against a narrower filtered active count would overstate the gap.
  const allTimeActivePatients = useMemo(() => new Set(accountRows.map((r) => r.patientId)).size, [accountRows]);

  const range = useMemo(() => resolveDateRange(preset, accountRows), [preset, accountRows]);
  const filtered = useMemo(() => filterByRange(accountRows, range), [accountRows, range]);
  const months = useMemo(() => monthsForRange(accountRows, range), [accountRows, range]);
  const metrics = useMemo(() => computeMetrics(filtered, months, accountRows), [filtered, months, accountRows]);
  const share = useMemo(() => computeShareOfTotal(filtered, filterByRange(rows, range), months), [filtered, rows, range, months]);

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

  const latestShare = share.length > 0 ? share[share.length - 1].sharePct : null;

  const bookedForAccount = useMemo(
    () => bookedSessions.filter((b) => b.account === account),
    [bookedSessions, account]
  );
  const bookedPipeline = useMemo(() => computeBookedPipeline(bookedForAccount), [bookedForAccount]);

  const { hidden, toggle } = useStatVisibility('account');

  const statCards = useMemo(() => {
    const cards: { key: string; label: string; node: ReactNode }[] = [
      { key: 'sessions', label: 'Sessions', node: <KpiCard label={`${account} sessions`} value={metrics.totalSessions.toLocaleString()} /> },
      { key: 'revenue', label: 'Revenue', node: <KpiCard label={`${account} revenue`} value={formatCurrency(metrics.revenue)} /> },
      { key: 'patients', label: 'Patients', node: <KpiCard label={`${account} patients`} value={metrics.uniquePatients.toLocaleString()} /> },
      { key: 'newPatients', label: 'New patients', node: <KpiCard label="New patients" value={metrics.newPatients.toLocaleString()} /> },
      {
        key: 'showUpRate',
        label: 'Show-up rate',
        node: (
          <KpiCard
            label="Show-up rate"
            value={metrics.showUpRate == null ? '—' : `${Math.round(metrics.showUpRate * 100)}%`}
          />
        ),
      },
      {
        key: 'shareOfTotal',
        label: 'Share of total sessions',
        node: <KpiCard label="Share of total sessions" value={latestShare == null ? '—' : `${Math.round(latestShare)}%`} />,
      },
    ];
    if (registeredCount > 0) {
      cards.push({
        key: 'registeredPatients',
        label: 'Registered patients',
        node: (
          <KpiCard
            label={`Registered ${account} patients`}
            value={registeredCount.toLocaleString()}
            sub={
              registeredCount > allTimeActivePatients
                ? `${(registeredCount - allTimeActivePatients).toLocaleString()} not yet booked`
                : 'All registered patients have booked'
            }
          />
        ),
      });
    }
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
    return cards;
  }, [account, metrics, latestShare, registeredCount, allTimeActivePatients, bookedForAccount, bookedPipeline]);

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title={`${account} sessions by month`} subtitle="By visit type">
          <SessionsByMonthChart data={metrics.sessionsByMonth} seriesKeys={metrics.seriesKeys} />
        </ChartCard>
        <ChartCard title="Share of total sessions" subtitle={`${account} as % of all clinic sessions`}>
          <SimpleLineChart
            data={share}
            xKey="label"
            yKey="sharePct"
            color={SERIES_COLORS[1]}
            valueFormatter={(v) => `${v.toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ChartCard title="Revenue by month" subtitle="Actual billed amount">
          <SimpleBarChart
            data={metrics.revenueByMonth}
            xKey="label"
            yKey="revenue"
            color={SERIES_COLORS[1]}
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
          />
        </ChartCard>
        <ChartCard title="New patients per month">
          <SimpleBarChart data={metrics.newPatientsByMonth} xKey="label" yKey="count" color={SERIES_COLORS[1]} />
        </ChartCard>
        {datedRegistered.length > 0 && (
          <ChartCard title="Registered patient growth" subtitle={`Running total of registered ${account} patients`}>
            <SimpleLineChart data={registeredGrowth} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
          </ChartCard>
        )}
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
