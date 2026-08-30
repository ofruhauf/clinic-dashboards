interface KpiCardProps {
  label: string;
  value: string;
  delta?: { pct: number; label: string } | null;
}

export default function KpiCard({ label, value, delta }: KpiCardProps) {
  const deltaColor = delta == null ? undefined : delta.pct >= 0 ? '#006300' : '#d03b3b';
  const deltaSign = delta == null ? '' : delta.pct >= 0 ? '▲' : '▼';

  return (
    <div
      style={{
        background: '#fcfcfb',
        border: '1px solid rgba(11,11,11,0.10)',
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: '#898781', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#0b0b0b', marginTop: 6, fontVariantNumeric: 'proportional-nums' }}>
        {value}
      </p>
      {delta && (
        <p style={{ fontSize: 12.5, color: deltaColor, marginTop: 4, fontWeight: 600 }}>
          {deltaSign} {Math.abs(delta.pct * 100).toFixed(1)}% {delta.label}
        </p>
      )}
    </div>
  );
}
