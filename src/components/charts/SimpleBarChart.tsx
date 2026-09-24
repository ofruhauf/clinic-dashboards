import type { TooltipContentProps } from 'recharts';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY, lighten } from '../../lib/theme';

interface ProjectedSeries {
  key: string; // data key for the projected remainder — 0 (or absent) except on the current, in-progress month
  label: string; // legend name, e.g. "Projected (month-to-date pace)"
}

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color: string;
  valueSuffix?: string;
  valueFormatter?: (v: number) => string;
  tickFormatter?: (v: number) => string;
  actualLabel?: string; // legend name for the real series — only shown once `projected` is set
  projected?: ProjectedSeries;
}

interface ProjectedTooltipProps extends TooltipContentProps {
  yKey: string;
  projected?: ProjectedSeries;
  format: (v: number) => string;
}

function ProjectedTooltip({ active, payload, label, yKey, projected, format }: ProjectedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as Record<string, unknown>;
  const actual = Number(row[yKey]) || 0;
  const remainder = projected ? Number(row[projected.key]) || 0 : 0;

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid rgba(11,11,11,0.10)',
        background: '#fcfcfb',
        padding: '8px 10px',
        fontSize: 12.5,
      }}
    >
      <div style={{ color: INK_PRIMARY, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{projected ? `Actual: ${format(actual)}` : format(actual)}</div>
      {remainder > 0 && (
        <div style={{ color: INK_MUTED }}>
          {projected!.label}: {format(actual + remainder)}
        </div>
      )}
    </div>
  );
}

export default function SimpleBarChart({
  data,
  xKey,
  yKey,
  color,
  valueSuffix = '',
  valueFormatter,
  tickFormatter,
  actualLabel = 'Actual',
  projected,
}: Props) {
  const format = (v: number) => (valueFormatter ? valueFormatter(v) : `${v}${valueSuffix}`);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRIDLINE} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          cursor={{ fill: 'rgba(11,11,11,0.04)' }}
          content={(props: TooltipContentProps) => (
            <ProjectedTooltip {...props} yKey={yKey} projected={projected} format={format} />
          )}
        />
        {projected && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: INK_MUTED, paddingTop: 8 }} />}
        <Bar
          dataKey={yKey}
          name={actualLabel}
          stackId={projected ? 'combined' : undefined}
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        {projected && (
          <Bar
            dataKey={projected.key}
            name={projected.label}
            stackId="combined"
            fill={lighten(color, 0.55)}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
