import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY } from '../../lib/theme';

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color: string;
  valueSuffix?: string;
  valueFormatter?: (v: number) => string;
}

export default function SimpleLineChart({ data, xKey, yKey, color, valueSuffix = '', valueFormatter }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRIDLINE} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: AXIS_LINE, strokeWidth: 1 }}
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
          formatter={(value) =>
            [valueFormatter ? valueFormatter(Number(value)) : `${value}${valueSuffix}`, undefined]
          }
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
