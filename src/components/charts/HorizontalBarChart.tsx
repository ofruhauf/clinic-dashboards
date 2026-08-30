import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_LINE, GRIDLINE, INK_MUTED, INK_PRIMARY } from '../../lib/theme';

interface Props {
  data: Record<string, unknown>[];
  categoryKey: string;
  valueKey: string;
  color: string;
}

export default function HorizontalBarChart({ data, categoryKey, valueKey, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        barCategoryGap="24%"
      >
        <CartesianGrid horizontal={false} stroke={GRIDLINE} />
        <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: AXIS_LINE }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          tick={{ fontSize: 11.5, fill: INK_PRIMARY }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: 'rgba(11,11,11,0.04)' }}
          contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
          labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
        />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
