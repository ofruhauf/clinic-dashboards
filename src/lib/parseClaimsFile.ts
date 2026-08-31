import type { AppointmentRow, ParsedDataset } from './types';

// Column names are matched case-insensitively with separators stripped, so
// "Date of Service" and "date_of_service" both resolve the same way.
const HEADER_ALIASES: Record<string, keyof RawRow> = {
  dateofservice: 'dateOfService',
  externalencounterid: 'encounterId',
  externalpatientid: 'patientId',
  patientfirstname: 'firstName',
  patientlastname: 'lastName',
  patientselfpay: 'selfPay',
  payername: 'payerName',
  appointmentname: 'title',
  procedurecode: 'procedureCode',
  chargeamountcents: 'chargeAmountCents',
  renderingproviderfirstname: 'therapistFirst',
  renderingproviderlastname: 'therapistLast',
  donotbill: 'doNotBill',
};

interface RawRow {
  dateOfService?: unknown;
  encounterId?: unknown;
  patientId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  selfPay?: unknown;
  payerName?: unknown;
  title?: unknown;
  procedureCode?: unknown;
  chargeAmountCents?: unknown;
  therapistFirst?: unknown;
  therapistLast?: unknown;
  doNotBill?: unknown;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function toBool(value: unknown): boolean {
  const s = toText(value).toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

/** Claims exports use DD/MM/YYYY (unambiguous here — day values exceed 12). */
function parseServiceDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toChargeDollars(value: unknown): number {
  const cents = Number(value);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

const PAYER_ALIASES: { pattern: RegExp; name: string }[] = [{ pattern: /horizon/i, name: 'Horizon' }];

function normalizePayer(raw: string): string {
  for (const { pattern, name } of PAYER_ALIASES) {
    if (pattern.test(raw)) return name;
  }
  return raw;
}

function resolveAccount(payerNameRaw: unknown, selfPayRaw: unknown): string | null {
  if (toBool(selfPayRaw)) return null;
  const payer = toText(payerNameRaw);
  return payer ? normalizePayer(payer) : null;
}

export async function parseClaimsFile(file: File): Promise<{ rows: AppointmentRow[]; skippedCount: number }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  // raw: true suppresses SheetJS's automatic date/number coercion — without it, ambiguous
  // DD/MM/YYYY strings (day <= 12) get silently reinterpreted as MM/DD/YYYY.
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no data.');
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

    if (toBool(mapped.doNotBill)) {
      skippedCount += 1;
      continue;
    }

    const patientId = toText(mapped.patientId);
    const scheduledFor = parseServiceDate(mapped.dateOfService);
    const firstName = toText(mapped.firstName);
    const lastName = toText(mapped.lastName);
    const patient = [firstName, lastName].filter(Boolean).join(' ');

    if (!patientId || !scheduledFor || !patient) {
      skippedCount += 1;
      continue;
    }

    const therapistFirst = toText(mapped.therapistFirst);
    const therapistLast = toText(mapped.therapistLast);
    const therapist = [therapistFirst, therapistLast].filter(Boolean).join(' ') || 'Unassigned';

    rows.push({
      patientId,
      patient,
      title: toText(mapped.title) || 'Unspecified',
      therapist,
      account: resolveAccount(mapped.payerName, mapped.selfPay),
      scheduledFor,
      chargeAmount: toChargeDollars(mapped.chargeAmountCents),
      procedureCode: toText(mapped.procedureCode) || null,
      showUp: null,
      encounterId: toText(mapped.encounterId),
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'No usable claim rows found. Make sure the file has date_of_service, external_patient_id, and patient name columns with values.'
    );
  }

  return { rows, skippedCount };
}

/**
 * Merge freshly parsed rows into an existing dataset, deduping by encounter
 * ID so re-uploading an overlapping week's report doesn't double-count.
 * Rows without an encounter ID can't be safely deduped and are always kept.
 */
export function mergeIntoDataset(
  existing: ParsedDataset | null,
  fileName: string,
  parsed: { rows: AppointmentRow[]; skippedCount: number }
): ParsedDataset {
  const existingIds = new Set(
    (existing?.rows ?? []).map((r) => r.encounterId).filter((id): id is string => Boolean(id))
  );

  const newRows: AppointmentRow[] = [];
  let duplicateCount = 0;
  for (const row of parsed.rows) {
    if (row.encounterId && existingIds.has(row.encounterId)) {
      duplicateCount += 1;
      continue;
    }
    if (row.encounterId) existingIds.add(row.encounterId);
    newRows.push(row);
  }

  return {
    rows: [...(existing?.rows ?? []), ...newRows],
    fileNames: [...(existing?.fileNames ?? []), fileName],
    uploadedAt: new Date().toISOString(),
    rowCount: (existing?.rows.length ?? 0) + newRows.length,
    skippedCount: (existing?.skippedCount ?? 0) + parsed.skippedCount,
    duplicateCount: (existing?.duplicateCount ?? 0) + duplicateCount,
  };
}
