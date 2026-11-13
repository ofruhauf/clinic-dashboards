import { useMemo } from 'react';
import ChartCard from '../components/ChartCard';
import SimpleBarChart from '../components/charts/SimpleBarChart';
import SimpleLineChart from '../components/charts/SimpleLineChart';
import { computeLtvCurve, computeLtvDistribution, computeRetentionCurve } from '../lib/metrics';
import type { HorizonDataset } from '../lib/types';
import { SERIES_COLORS } from '../lib/theme';
import { formatCurrency, formatPercent } from '../lib/format';

interface RetentionViewProps {
  dataset: HorizonDataset;
}

export default function RetentionView({ dataset }: RetentionViewProps) {
  const retentionCurve = useMemo(() => computeRetentionCurve(dataset.users, dataset.months), [dataset.users, dataset.months]);
  const ltvCurve = useMemo(() => computeLtvCurve(dataset.users, dataset.months), [dataset.users, dataset.months]);
  const ltvDistribution = useMemo(() => computeLtvDistribution(dataset.users), [dataset.users]);

  const deepestCohortSize = retentionCurve.length > 0 ? retentionCurve[retentionCurve.length - 1].cohortSize : 0;

  if (dataset.users.length === 0) {
    return <p style={{ color: '#898781', fontSize: 14 }}>No users found in the uploaded workbook.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12.5, color: '#898781', margin: 0 }}>
        Cohort-based — every chart here is grouped by months since each patient's registration, not by calendar
        month, and always covers every patient's full history.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ChartCard
          title="Horizon member retention"
          subtitle="% of each cohort still billable (1+ coaching or therapy session) N months after joining"
        >
          <SimpleLineChart
            data={retentionCurve}
            xKey="label"
            yKey="rate"
            color={SERIES_COLORS[1]}
            valueFormatter={formatPercent}
            tickFormatter={formatPercent}
            allowDecimals
          />
        </ChartCard>
        <ChartCard
          title="Cumulative LTV by months since joining"
          subtitle="Average total value per patient, observed to date — not a modeled projection"
        >
          <SimpleLineChart data={ltvCurve} xKey="label" yKey="avgValue" color={SERIES_COLORS[1]} valueFormatter={formatCurrency} />
        </ChartCard>
      </div>

      <p style={{ fontSize: 12, color: '#898781', margin: 0 }}>
        Later months rest on fewer cohorts that have aged that far — the last point above is based on{' '}
        {deepestCohortSize.toLocaleString()} patient{deepestCohortSize === 1 ? '' : 's'}, read it as directional, not
        exact.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ChartCard title="LTV distribution" subtitle="Patients by all-time total value">
          <SimpleBarChart data={ltvDistribution} xKey="label" yKey="count" color={SERIES_COLORS[1]} />
        </ChartCard>
      </div>
    </div>
  );
}
