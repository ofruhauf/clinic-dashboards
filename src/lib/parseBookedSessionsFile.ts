import type { BookedSessionRow } from './types';
import { normalizePayer } from './parseClaimsFile';

// Exported directly from the practice's scheduling CRM (not the claims/billing
// system) — appointments booked but not yet happened, so there's no charge
// amount, procedure code, or encounter ID to read. Only patient name,
// insurance, scheduled date, and status are read.
const PATIENT_KEY = 'user';
const INSURANCE_KEY = 'insurance';
const SCHEDULED_FOR_KEY = 'scheduledfor';
const STATUS_KEY = 'status';

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

/**
 * Cheap check of just the header row to tell a booked-sessions CRM export
 * apart from a claims report or registered-users export before committing to
 * a parser — all can arrive as .csv or .xlsx, so the extension alone can't
 * tell them apart.
 */
export async function looksLikeBookedSessionsFile(file: File): Promise<boolean> {
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

export async function parseBookedSessionsFile(
  file: File
): Promise<{ bookedSessions: BookedSessionRow[]; skippedCount: number }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no data.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const bookedSessions: BookedSessionRow[] = [];
  let skippedCount = 0;

  for (const raw of rawRows) {
    let patient = '';
    let insuranceRaw = '';
    let scheduledForRaw: unknown = null;
    let status = '';
    for (const [key, value] of Object.entries(raw)) {
      const normalized = normalizeKey(key);
      if (normalized === PATIENT_KEY) patient = toText(value);
      else if (normalized === INSURANCE_KEY) insuranceRaw = toText(value);
      else if (normalized === SCHEDULED_FOR_KEY) scheduledForRaw = value;
      else if (normalized === STATUS_KEY) status = toText(value);
    }

    const scheduledFor = parseScheduledFor(scheduledForRaw);
    if (!patient || !scheduledFor) {
      skippedCount += 1;
      continue;
    }

    bookedSessions.push({
      patient,
      account: insuranceRaw ? normalizePayer(insuranceRaw) : null,
      scheduledFor,
      status,
    });
  }

  if (bookedSessions.length === 0) {
    throw new Error('No usable booked-session rows found. Make sure the file has user, scheduledFor, and status columns with values.');
  }

  return { bookedSessions, skippedCount };
}
