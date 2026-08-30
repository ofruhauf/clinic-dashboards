import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlySeriesPoint } from '../../lib/metrics';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY, seriesColor } from '../../lib/theme';

interface Props {
  data: MonthlySeriesPoint[];
  seriesKeys: string[];
}

export default function SessionsByMonthChart({ data, seriesKeys }: Props) {
  const singleSeries = seriesKeys.length <= 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRIDLINE} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'rgba(11,11,11,0.04)' }}
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
        />
        {!singleSeries && (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: INK_MUTED, paddingTop: 8 }}
          />
        )}
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="sessions"
            fill={seriesColor(i)}
            radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
