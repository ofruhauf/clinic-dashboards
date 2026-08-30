import type { AppointmentRow, ParsedDataset } from './types';

// Header names are matched case-insensitively, ignoring surrounding whitespace,
// so minor spreadsheet variations (e.g. "Scheduled For") still map correctly.
const HEADER_ALIASES: Record<string, keyof RawRow> = {
  user: 'user',
  patient: 'user',
  title: 'title',
  visittype: 'title',
  therapist: 'therapist',
  provider: 'therapist',
  insurance: 'insurance',
  account: 'insurance',
  payer: 'insurance',
  scheduledfor: 'scheduledFor',
  scheduled: 'scheduledFor',
  date: 'scheduledFor',
  paymentmethod: 'paymentMethod',
  status: 'status',
  showup: 'showUp',
  reported: 'reported',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
};

interface RawRow {
  user?: unknown;
  title?: unknown;
  therapist?: unknown;
  insurance?: unknown;
  scheduledFor?: unknown;
  paymentMethod?: unknown;
  status?: unknown;
  showUp?: unknown;
  reported?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

type SSF = typeof import('xlsx')['SSF'];

function toDate(value: unknown, ssf: SSF): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Excel serial date
    const parsed = ssf.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)));
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toBool(value: unknown): boolean | null {
  if (value == null || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'yes' || s === 'true' || s === 'y' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === 'n' || s === '0') return false;
  return null;
}

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text === '' ? null : text;
}

export async function parseExcelFile(file: File): Promise<ParsedDataset> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The workbook has no sheets.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const rows: AppointmentRow[] = [];
  let skippedCount = 0;

  for (const raw of rawRows) {
    const mapped: RawRow = {};
    for (const [key, value] of Object.entries(raw)) {
      const target = HEADER_ALIASES[normalizeKey(key)];
      if (target) mapped[target] = value;
    }

    const patient = toText(mapped.user);
    const scheduledFor = toDate(mapped.scheduledFor, XLSX.SSF);

    if (!patient || !scheduledFor) {
      skippedCount += 1;
      continue;
    }

    rows.push({
      patient,
      title: toText(mapped.title) || 'Unspecified',
      therapist: toText(mapped.therapist) || 'Unassigned',
      account: toNullableText(mapped.insurance),
      scheduledFor,
      paymentMethod: toNullableText(mapped.paymentMethod),
      status: toText(mapped.status) || 'Unknown',
      showUp: toBool(mapped.showUp),
      reported: toBool(mapped.reported),
      createdAt: toDate(mapped.createdAt, XLSX.SSF),
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'No usable rows found. Make sure the sheet has "user" and "scheduledFor" columns with values.'
    );
  }

  return {
    rows,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    rowCount: rows.length,
    skippedCount,
  };
}
