import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}

export default function ChartCard({ title, subtitle, children, height = 280 }: ChartCardProps) {
  return (
    <div
      style={{
        background: '#fcfcfb',
        border: '1px solid rgba(11,11,11,0.10)',
        borderRadius: 12,
        padding: '18px 20px 8px',
      }}
    >
      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0b0b0b' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12.5, color: '#898781', marginTop: 2 }}>{subtitle}</p>}
      <div style={{ height, marginTop: 12 }}>{children}</div>
    </div>
  );
}
