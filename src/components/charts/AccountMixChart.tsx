import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { INK_MUTED, INK_PRIMARY, SERIES_COLORS } from '../../lib/theme';

interface Props {
  data: { name: string; count: number }[];
}

export default function AccountMixChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
      <div style={{ width: '52%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="#fcfcfb"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12.5 }}
              labelStyle={{ color: INK_PRIMARY, fontWeight: 600 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minWidth: 0 }}>
        {data.map((entry, i) => (
          <li
            key={entry.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: INK_PRIMARY,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
            <span style={{ marginLeft: 'auto', color: INK_MUTED, fontWeight: 600 }}>
              {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
