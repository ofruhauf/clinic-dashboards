import { useMemo } from 'react';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import AccountMixChart from '../components/charts/AccountMixChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import SessionsByMonthChart from '../components/charts/SessionsByMonthChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import { computeMetrics, filterByRange, monthsForRange, resolveDateRange } from '../lib/metrics';
import type { AppointmentRow, DateRangePreset } from '../lib/types';
import { SERIES_COLORS } from '../lib/theme';

interface OverviewProps {
  rows: AppointmentRow[];
  preset: DateRangePreset;
}

export default function Overview({ rows, preset }: OverviewProps) {
  const range = useMemo(() => resolveDateRange(preset, rows), [preset, rows]);
  const filtered = useMemo(() => filterByRange(rows, range), [rows, range]);
  const months = useMemo(() => monthsForRange(rows, range), [rows, range]);
  const metrics = useMemo(() => computeMetrics(filtered, months, rows), [filtered, months, rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard label="Total sessions" value={metrics.totalSessions.toLocaleString()} />
        <KpiCard label="Unique patients" value={metrics.uniquePatients.toLocaleString()} />
        <KpiCard label="New patients" value={metrics.newPatients.toLocaleString()} />
        <KpiCard
          label="Show-up rate"
          value={metrics.showUpRate == null ? '—' : `${Math.round(metrics.showUpRate * 100)}%`}
        />
        <KpiCard
          label="Month-over-month growth"
          value={metrics.momGrowthPct == null ? '—' : `${metrics.momGrowthPct >= 0 ? '+' : ''}${Math.round(metrics.momGrowthPct * 100)}%`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <ChartCard title="Sessions by month" subtitle="By visit type">
          <SessionsByMonthChart data={metrics.sessionsByMonth} seriesKeys={metrics.seriesKeys} />
        </ChartCard>
        <ChartCard title="Account mix" subtitle="Share of sessions by payer">
          <AccountMixChart data={metrics.accountMix} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="New patients per month">
          <SimpleBarChart data={metrics.newPatientsByMonth} xKey="label" yKey="count" color={SERIES_COLORS[0]} />
        </ChartCard>
        <ChartCard title="Cumulative patient growth" subtitle="Running total of patients seen">
          <SimpleLineChart data={metrics.cumulativePatients} xKey="label" yKey="total" color={SERIES_COLORS[0]} />
        </ChartCard>
      </div>

      <ChartCard title="Sessions by therapist" height={Math.max(200, metrics.sessionsByTherapist.length * 34)}>
        <HorizontalBarChart data={metrics.sessionsByTherapist} categoryKey="name" valueKey="count" color={SERIES_COLORS[0]} />
      </ChartCard>
    </div>
  );
}
