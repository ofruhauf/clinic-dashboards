import type { AppointmentRow, ParsedDataset } from './types';

// v2: switched from scheduling-export rows to claims rows (different shape) —
// bumped so any old-format data cached in a browser is cleanly ignored
// rather than loaded and misread.
const STORAGE_KEY = 'agave-dashboard:dataset:v2';

interface SerializedRow extends Omit<AppointmentRow, 'scheduledFor'> {
  scheduledFor: string;
}

interface SerializedDataset extends Omit<ParsedDataset, 'rows'> {
  rows: SerializedRow[];
}

export function saveDataset(dataset: ParsedDataset): void {
  const serialized: SerializedDataset = {
    ...dataset,
    rows: dataset.rows.map((row) => ({
      ...row,
      scheduledFor: row.scheduledFor.toISOString(),
    })),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Storage full or unavailable (private browsing) — dataset still works for this session.
  }
}

export function loadDataset(): ParsedDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedDataset;
    return {
      ...parsed,
      rows: parsed.rows.map((row) => ({
        ...row,
        scheduledFor: new Date(row.scheduledFor),
      })),
    };
  } catch {
    return null;
  }
}

export function clearDataset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
