import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY } from '../../lib/theme';

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color: string;
  valueSuffix?: string;
  valueFormatter?: (v: number) => string;
  tickFormatter?: (v: number) => string;
}

export default function SimpleBarChart({
  data,
  xKey,
  yKey,
  color,
  valueSuffix = '',
  valueFormatter,
  tickFormatter,
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
          formatter={(value) => [valueFormatter ? valueFormatter(Number(value)) : `${value}${valueSuffix}`, undefined]}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
