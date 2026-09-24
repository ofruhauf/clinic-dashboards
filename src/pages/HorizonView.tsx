import { useMemo, type ReactNode } from 'react';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import CustomizeStatsButton from '../components/CustomizeStatsButton';
import SessionsByMonthChart from '../components/charts/SessionsByMonthChart';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import {
  computeEngagedGrowth,
  computeHorizonPeriodMetrics,
  computeNewPatientsByMonth,
  computeRegisteredGrowth,
  countEngaged,
  countRegistered,
  HORIZON_SERIES_KEYS,
  resolveHorizonMonthWindow,
} from '../lib/metrics';
import type { DateRangePreset, HorizonDataset } from '../lib/types';
import { SERIES_COLORS } from '../lib/theme';
import { formatCurrency, formatCurrencyCompact } from '../lib/format';
import { useStatVisibility } from '../lib/useStatVisibility';

interface HorizonViewProps {
  dataset: HorizonDataset;
  preset: DateRangePreset;
}

export default function HorizonView({ dataset, preset }: HorizonViewProps) {
  const windowMonths = useMemo(
    () => resolveHorizonMonthWindow(preset, dataset.months),
    [preset, dataset.months]
  );
  const periodMetrics = useMemo(
    () => computeHorizonPeriodMetrics(dataset.users, windowMonths),
    [dataset.users, windowMonths]
  );
  const newPatientsByMonth = useMemo(
    () => computeNewPatientsByMonth(dataset.users, windowMonths),
    [dataset.users, windowMonths]
  );
  const registeredGrowth = useMemo(
    () => computeRegisteredGrowth(dataset.users, windowMonths),
    [dataset.users, windowMonths]
  );
  const engagedGrowth = useMemo(
    () => computeEngagedGrowth(dataset.users, windowMonths),
    [dataset.users, windowMonths]
  );

  const registeredCount = useMemo(() => countRegistered(dataset.users), [dataset.users]);
  const engagedCount = useMemo(() => countEngaged(dataset.users), [dataset.users]);
  const newPatients = useMemo(() => newPatientsByMonth.reduce((sum, p) => sum + p.count, 0), [newPatientsByMonth]);

  const { hidden, toggle } = useStatVisibility('account');

  const statCards = useMemo(() => {
    const cards: { key: string; label: string; node: ReactNode }[] = [
      { key: 'registeredPatients', label: 'Registered patients', node: <KpiCard label="Registered patients" value={registeredCount.toLocaleString()} /> },
      { key: 'patients', label: 'Patients treated', node: <KpiCard label="Patients treated" value={engagedCount.toLocaleString()} /> },
      { key: 'sessions', label: 'Sessions', node: <KpiCard label="Horizon sessions" value={periodMetrics.totalSessions.toLocaleString()} /> },
      { key: 'revenue', label: 'Revenue', node: <KpiCard label="Horizon revenue" value={formatCurrency(periodMetrics.revenue)} /> },
      { key: 'newPatients', label: 'New patients', node: <KpiCard label="New patients" value={newPatients.toLocaleString()} /> },
    ];
    return cards;
  }, [registeredCount, engagedCount, periodMetrics, newPatients]);

  if (dataset.users.length === 0) {
    return <p style={{ color: '#898781', fontSize: 14 }}>No users found in the uploaded workbook.</p>;
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
        <ChartCard title="Horizon sessions by month" subtitle="Evaluation, coaching, and therapy">
          <SessionsByMonthChart data={periodMetrics.sessionsByMonth} seriesKeys={HORIZON_SERIES_KEYS} />
        </ChartCard>
        <ChartCard title="Registered patient growth" subtitle="Running total of registered Horizon patients">
          <SimpleLineChart data={registeredGrowth} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ChartCard
          title="Revenue by month"
          subtitle="Value recognized per the tracking workbook · faded = projected full-month pace"
        >
          <SimpleBarChart
            data={periodMetrics.revenueByMonth}
            xKey="label"
            yKey="revenue"
            color={SERIES_COLORS[1]}
            valueFormatter={formatCurrency}
            tickFormatter={formatCurrencyCompact}
            projected={{ key: 'projected', label: 'Projected (month-to-date pace)' }}
          />
        </ChartCard>
        <ChartCard title="New patients per month" subtitle="Faded = projected full-month pace">
          <SimpleBarChart
            data={newPatientsByMonth}
            xKey="label"
            yKey="count"
            color={SERIES_COLORS[1]}
            projected={{ key: 'projected', label: 'Projected (month-to-date pace)' }}
          />
        </ChartCard>
        <ChartCard title="Engaged (in-care) patient growth" subtitle="Running total of patients with a coaching or therapy session">
          <SimpleLineChart data={engagedGrowth} xKey="label" yKey="total" color={SERIES_COLORS[1]} />
        </ChartCard>
      </div>
    </div>
  );
}
