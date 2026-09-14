import type { SessionRow } from './types';
import { normalizePayer } from './parseClaimsFile';

// Exported directly from the practice's scheduling CRM — every session, past
// and scheduled, not just upcoming ones. Only patient name, visit type,
// insurance carrier, scheduled date, status, and show-up outcome are read.
const PATIENT_KEY = 'user';
const TITLE_KEY = 'title';
const INSURANCE_KEY = 'insurancecarrier';
const SCHEDULED_FOR_KEY = 'scheduledfor';
const STATUS_KEY = 'status';
const SHOW_UP_KEY = 'showup';

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

/** The CRM export uses a plain ISO 8601 UTC timestamp — unambiguous. */
function parseScheduledFor(value: unknown): Date | null {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseShowUp(value: unknown): boolean | null {
  const text = toText(value).toLowerCase();
  if (text === 'yes') return true;
  if (text === 'no') return false;
  return null;
}

/**
 * Cheap check of just the header row to tell a sessions CRM export apart
 * from a claims report or registered-users export before committing to a
 * parser — all can arrive as .csv or .xlsx, so the extension alone can't
 * tell them apart.
 */
export async function looksLikeSessionsFile(file: File): Promise<boolean> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, sheetRows: 1 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return false;
  const sheet = workbook.Sheets[sheetName];
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (!headerRow) return false;
  const normalized = new Set(headerRow.map((h) => normalizeKey(String(h ?? ''))));
  return normalized.has(PATIENT_KEY) && normalized.has(SCHEDULED_FOR_KEY) && normalized.has(STATUS_KEY);
}

export async function parseSessionsFile(file: File): Promise<{ sessions: SessionRow[]; skippedCount: number }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no data.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const sessions: SessionRow[] = [];
  let skippedCount = 0;

  for (const raw of rawRows) {
    let patient = '';
    let title = '';
    let insuranceRaw = '';
    let scheduledForRaw: unknown = null;
    let status = '';
    let showUpRaw: unknown = null;
    for (const [key, value] of Object.entries(raw)) {
      const normalized = normalizeKey(key);
      if (normalized === PATIENT_KEY) patient = toText(value);
      else if (normalized === TITLE_KEY) title = toText(value);
      else if (normalized === INSURANCE_KEY) insuranceRaw = toText(value);
      else if (normalized === SCHEDULED_FOR_KEY) scheduledForRaw = value;
      else if (normalized === STATUS_KEY) status = toText(value);
      else if (normalized === SHOW_UP_KEY) showUpRaw = value;
    }

    const scheduledFor = parseScheduledFor(scheduledForRaw);
    if (!patient || !scheduledFor) {
      skippedCount += 1;
      continue;
    }

    sessions.push({
      patient,
      title: title || 'Unspecified',
      account: insuranceRaw ? normalizePayer(insuranceRaw) : null,
      scheduledFor,
      status,
      showUp: parseShowUp(showUpRaw),
    });
  }

  if (sessions.length === 0) {
    throw new Error('No usable session rows found. Make sure the file has user, scheduledFor, and status columns with values.');
  }

  return { sessions, skippedCount };
}
