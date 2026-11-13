import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY, seriesColor } from '../../lib/theme';

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  seriesKeys: string[];
  valueFormatter?: (v: number) => string;
  tickFormatter?: (v: number) => string;
}

/** Multiple lines, one per cohort — each stops drawing once that cohort runs out of observed months, rather than continuing flat or dropping to zero. */
export default function CohortLineChart({ data, xKey, seriesKeys, valueFormatter, tickFormatter }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRIDLINE} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals
          tickFormatter={tickFormatter}
        />
        <Tooltip
          cursor={{ stroke: AXIS_LINE, strokeWidth: 1 }}
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
          formatter={(value) => [
            value == null ? '—' : valueFormatter ? valueFormatter(Number(value)) : String(value),
            undefined,
          ]}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: INK_MUTED, paddingTop: 8 }} />
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={{ r: 3, fill: seriesColor(i), strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
