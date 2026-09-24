import type { HorizonDataset, HorizonMonthActivity, HorizonUserRow } from './types';

// v4: full rebuild around the "Users Tracking" workbook as the single source
// of truth, replacing the claims/registered-users/sessions-CRM pipeline
// entirely — a completely different shape, so bumped to cleanly ignore any
// old-format data cached in a browser rather than misread it.
const STORAGE_KEY = 'agave-dashboard:dataset:v4';

interface SerializedUserRow extends Omit<HorizonUserRow, 'createdAt'> {
  createdAt: string;
}

export interface SerializedDataset extends Omit<HorizonDataset, 'users'> {
  users: SerializedUserRow[];
}

export function serializeDataset(dataset: HorizonDataset): SerializedDataset {
  return {
    ...dataset,
    users: dataset.users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  };
}

export function deserializeDataset(serialized: SerializedDataset): HorizonDataset {
  return {
    ...serialized,
    users: serialized.users.map((u) => ({
      ...u,
      createdAt: new Date(u.createdAt),
      monthly: u.monthly as HorizonMonthActivity[],
    })),
  };
}

export function saveDataset(dataset: HorizonDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDataset(dataset)));
  } catch {
    // Storage full or unavailable (private browsing) — dataset still works for this session.
  }
}

export function loadDataset(): HorizonDataset | null {
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
