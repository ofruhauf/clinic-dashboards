import { useMemo } from 'react';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import SessionsByMonthChart from '../components/charts/SessionsByMonthChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  computeMetrics,
  computeShareOfTotal,
  filterByRange,
  monthsForRange,
  resolveDateRange,
} from '../lib/metrics';
import type { AppointmentRow, DateRangePreset } from '../lib/types';
import { SERIES_COLORS } from '../lib/theme';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';

interface AccountViewProps {
  rows: AppointmentRow[];
  account: string;
  preset: DateRangePreset;
}

export default function AccountView({ rows, account, preset }: AccountViewProps) {
  const accountRows = useMemo(() => rows.filter((r) => r.account === account), [rows, account]);

  const range = useMemo(() => resolveDateRange(preset, accountRows), [preset, accountRows]);
  const filtered = useMemo(() => filterByRange(accountRows, range), [accountRows, range]);
  const months = useMemo(() => monthsForRange(accountRows, range), [accountRows, range]);
  const metrics = useMemo(() => computeMetrics(filtered, months, accountRows), [filtered, months, accountRows]);
  const share = useMemo(() => computeShareOfTotal(filtered, filterByRange(rows, range), months), [filtered, rows, range, months]);

  const latestShare = share.length > 0 ? share[share.length - 1].sharePct : null;

  if (accountRows.length === 0) {
    return (
      <p style={{ color: '#898781', fontSize: 14 }}>
        No sessions found for <strong>{account}</strong> in the uploaded data.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard label={`${account} sessions`} value={metrics.totalSessions.toLocaleString()} />
        <KpiCard label={`${account} revenue`} value={formatCurrency(metrics.revenue)} />
        <KpiCard label={`${account} patients`} value={metrics.uniquePatients.toLocaleString()} />
        <KpiCard label="New patients" value={metrics.newPatients.toLocaleString()} />
        <KpiCard
          label="Show-up rate"
          value={metrics.showUpRate == null ? '—' : `${Math.round(metrics.showUpRate * 100)}%`}
        />
        <KpiCard label="Share of total sessions" value={latestShare == null ? '—' : `${Math.round(latestShare)}%`} />
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
        <ChartCard title="Cumulative patient growth" subtitle={`Running total of ${account} patients`}>
          <SimpleLineChart data={metrics.cumulativePatients} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
        </ChartCard>
      </div>
    </div>
  );
}
