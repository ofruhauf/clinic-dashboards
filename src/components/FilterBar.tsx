import type { DateRangePreset } from '../lib/types';

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'last3', label: 'Last 3 months' },
  { value: 'last6', label: 'Last 6 months' },
  { value: 'last12', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

interface FilterBarProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  accounts?: { name: string; sessions: number }[];
  selectedAccount?: string;
  onAccountChange?: (account: string) => void;
}

const selectStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid rgba(11,11,11,0.15)',
  background: '#fcfcfb',
  color: '#0b0b0b',
};

export default function FilterBar({ preset, onPresetChange, accounts, selectedAccount, onAccountChange }: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {accounts && onAccountChange && (
        <select value={selectedAccount} onChange={(e) => onAccountChange(e.target.value)} style={selectStyle}>
          {accounts.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      <select value={preset} onChange={(e) => onPresetChange(e.target.value as DateRangePreset)} style={selectStyle}>
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
