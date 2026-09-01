import type { AppointmentRow, ParsedDataset, RegisteredPatientRow } from './types';
import { deserializeDataset, serializeDataset, type SerializedDataset } from './storage';

/**
 * Lets two people share a dataset without a backend: one side downloads a
 * snapshot file of everything currently loaded, sends it (email, Slack,
 * AirDrop — whatever), and the other side drops it into the same upload
 * panel. It merges like any other file, so it can seed an empty dashboard
 * or update one that already has data loaded.
 */
export function downloadSnapshot(dataset: ParsedDataset): void {
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

export async function parseSnapshotFile(
  file: File
): Promise<{ rows: AppointmentRow[]; registeredPatients: RegisteredPatientRow[]; skippedCount: number }> {
  const text = await file.text();
  let parsed: SerializedDataset;
  try {
    parsed = JSON.parse(text) as SerializedDataset;
  } catch {
    throw new Error('Not a valid snapshot file (couldn\'t parse JSON).');
  }
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error('Not a valid Agave dashboard snapshot file.');
  }
  const dataset = deserializeDataset(parsed);
  return { rows: dataset.rows, registeredPatients: dataset.registeredPatients, skippedCount: 0 };
}
