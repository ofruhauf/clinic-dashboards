import { useState } from 'react';

interface StatOption {
  key: string;
  label: string;
}

interface CustomizeStatsButtonProps {
  options: StatOption[];
  hidden: string[];
  onToggle: (key: string) => void;
}

export default function CustomizeStatsButton({ options, hidden, onToggle }: CustomizeStatsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: '#52514e',
          background: 'transparent',
          border: '1px solid rgba(11,11,11,0.15)',
          borderRadius: 8,
          padding: '6px 11px',
          cursor: 'pointer',
        }}
      >
        Customize stats
      </button>

      {open && (
        <>
          {/* Click-outside-to-close backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 20 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 21,
              background: '#fcfcfb',
              border: '1px solid rgba(11,11,11,0.15)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(11,11,11,0.12)',
              padding: 14,
              minWidth: 240,
            }}
          >
            <p style={{ fontSize: 11.5, fontWeight: 700, color: '#898781', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Show stats
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {options.map((opt) => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0b0b0b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!hidden.includes(opt.key)} onChange={() => onToggle(opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 12,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                background: '#2a78d6',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
