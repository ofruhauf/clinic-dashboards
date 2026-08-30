import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY } from '../../lib/theme';

interface Props {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color: string;
  gradientId: string;
  valueFormatter?: (v: number) => string;
  tickFormatter?: (v: number) => string;
}

export default function HeroAreaChart({ data, xKey, yKey, color, gradientId, valueFormatter, tickFormatter }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRIDLINE} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12.5, fill: INK_MUTED }}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 12.5, fill: INK_MUTED }}
          tickLine={false}
          axisLine={false}
          width={56}
          allowDecimals={false}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          cursor={{ stroke: AXIS_LINE, strokeWidth: 1 }}
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 13 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
          formatter={(value) => [valueFormatter ? valueFormatter(Number(value)) : value, undefined]}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={3}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
