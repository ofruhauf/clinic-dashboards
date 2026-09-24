import type { HorizonDataset, HorizonUserRow } from './types';
import { deserializeDataset, serializeDataset, type SerializedDataset } from './storage';

/**
 * Lets two people share a dataset without a backend: one side downloads a
 * snapshot file of everything currently loaded, sends it (email, Slack,
 * AirDrop — whatever), and the other side drops it into the same upload
 * panel to see the identical dashboard without re-uploading the workbook.
 */
export function downloadSnapshot(dataset: HorizonDataset): void {
  const blob = new Blob([JSON.stringify(serializeDataset(dataset))], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agave-dashboard-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function isSnapshotFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.json');
}

export async function parseSnapshotFile(file: File): Promise<{ users: HorizonUserRow[]; months: string[]; skippedCount: number }> {
  const text = await file.text();
  let parsed: SerializedDataset;
  try {
    parsed = JSON.parse(text) as SerializedDataset;
  } catch {
    throw new Error('Not a valid snapshot file (couldn\'t parse JSON).');
  }
  if (!parsed || !Array.isArray(parsed.users)) {
    throw new Error('Not a valid Agave dashboard snapshot file.');
  }
  const dataset = deserializeDataset(parsed);
  return { users: dataset.users, months: dataset.months, skippedCount: 0 };
}
