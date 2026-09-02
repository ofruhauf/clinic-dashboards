import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY, PROJECTED } from '../../lib/theme';

interface ProjectedSeries {
  key: string; // data key for the projected values — 0 (or absent) on actual months, set on future months
  label: string; // legend/tooltip name, e.g. "Booked (upcoming)"
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
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
          formatter={(value, name) => [
            valueFormatter ? valueFormatter(Number(value)) : `${value}${valueSuffix}`,
            projected ? name : undefined,
          ]}
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
            fill={PROJECTED}
            fillOpacity={0.35}
            stroke={PROJECTED}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
