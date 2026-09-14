import type { AppointmentRow, ParsedDataset, RegisteredPatientRow, SessionRow } from './types';

// v3: the booked-sessions (future-only) export was replaced by a sessions
// export covering every session past and scheduled, with a different shape
// (adds title/showUp) and a different meaning (no longer "just upcoming") —
// bumped so any old-format data cached in a browser is cleanly ignored
// rather than loaded and misread.
const STORAGE_KEY = 'agave-dashboard:dataset:v3';

interface SerializedRow extends Omit<AppointmentRow, 'scheduledFor'> {
  scheduledFor: string;
}

interface SerializedRegisteredPatientRow extends Omit<RegisteredPatientRow, 'registeredAt'> {
  registeredAt: string | null;
}

interface SerializedSessionRow extends Omit<SessionRow, 'scheduledFor'> {
  scheduledFor: string;
}

export interface SerializedDataset
  extends Omit<ParsedDataset, 'rows' | 'registeredPatients' | 'sessions'> {
  rows: SerializedRow[];
  registeredPatients: SerializedRegisteredPatientRow[];
  sessions: SerializedSessionRow[];
}

// Shared by localStorage persistence and the export/import snapshot feature —
// both need the same Date <-> ISO-string round trip.
export function serializeDataset(dataset: ParsedDataset): SerializedDataset {
  return {
    ...dataset,
    rows: dataset.rows.map((row) => ({
      ...row,
      scheduledFor: row.scheduledFor.toISOString(),
    })),
    registeredPatients: dataset.registeredPatients.map((p) => ({
      ...p,
      registeredAt: p.registeredAt ? p.registeredAt.toISOString() : null,
    })),
    sessions: dataset.sessions.map((s) => ({
      ...s,
      scheduledFor: s.scheduledFor.toISOString(),
    })),
  };
}

export function deserializeDataset(serialized: SerializedDataset): ParsedDataset {
  return {
    ...serialized,
    rows: serialized.rows.map((row) => ({
      ...row,
      scheduledFor: new Date(row.scheduledFor),
    })),
    // Older cached data / snapshot files predate these fields — default so the
    // rest of the app can always assume they're present, not undefined.
    registeredPatients: (serialized.registeredPatients ?? []).map((p) => ({
      ...p,
      registeredAt: p.registeredAt ? new Date(p.registeredAt) : null,
    })),
    sessions: (serialized.sessions ?? []).map((s) => ({
      ...s,
      scheduledFor: new Date(s.scheduledFor),
    })),
    registeredDuplicateCount: serialized.registeredDuplicateCount ?? 0,
  };
}

export function saveDataset(dataset: ParsedDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDataset(dataset)));
  } catch {
    // Storage full or unavailable (private browsing) — dataset still works for this session.
  }
}

export function loadDataset(): ParsedDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializeDataset(JSON.parse(raw) as SerializedDataset);
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
