interface HeroStatProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

export default function HeroStat({ label, value, sub, accent }: HeroStatProps) {
  return (
    <div
      style={{
        background: '#fcfcfb',
        border: '1px solid rgba(11,11,11,0.10)',
        borderTop: `3px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 20px',
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, color: '#898781', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ fontSize: 34, fontWeight: 800, color: '#0b0b0b', marginTop: 6, letterSpacing: -0.5 }}>{value}</p>
      {sub && <p style={{ fontSize: 12.5, color: '#52514e', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}
