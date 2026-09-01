import type { AppointmentRow, ParsedDataset, RegisteredPatientRow } from './types';

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

// Exported so other sources of account/company names (e.g. the registered-users
// export) normalize to the same canonical names as claims data — "Horizon" needs
// to mean the same thing everywhere it's used to filter/group.
export function normalizePayer(raw: string): string {
  for (const { pattern, name } of PAYER_ALIASES) {
    if (pattern.test(raw)) return name;
  }
  return raw;
}

// H0038 is the billing code for coaching sessions. Some rows in real exports
// carry a stale/incorrect appointment_name (e.g. "ADHD evaluation") on an
// H0038 line, so the procedure code — not the free-text appointment name —
// is the reliable signal for coaching. Also collapses "Coaching" / "ADHD
// coaching" / "ADHD Coaching" text variants into one canonical series.
const COACHING_PROCEDURE_CODES = new Set(['h0038']);

function isCoachingProcedureCode(procedureCode: string | null): boolean {
  return COACHING_PROCEDURE_CODES.has((procedureCode ?? '').trim().toLowerCase());
}

function normalizeVisitType(appointmentNameRaw: string, procedureCodeRaw: string): string {
  if (isCoachingProcedureCode(procedureCodeRaw)) return 'Coaching';
  const name = appointmentNameRaw.trim();
  if (!name) return 'Unspecified';
  if (/coaching/i.test(name)) return 'Coaching';
  return name;
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

    const procedureCode = toText(mapped.procedureCode);

    rows.push({
      patientId,
      patient,
      title: normalizeVisitType(toText(mapped.title), procedureCode),
      therapist,
      account: resolveAccount(mapped.payerName, mapped.selfPay),
      scheduledFor,
      chargeAmount: toChargeDollars(mapped.chargeAmountCents),
      procedureCode: procedureCode || null,
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

function claimKey(row: Pick<AppointmentRow, 'encounterId' | 'scheduledFor'>): string | null {
  if (!row.encounterId) return null;
  return `${row.encounterId}|${row.scheduledFor.toISOString().slice(0, 10)}`;
}

/**
 * Merge freshly parsed claim rows into the existing set, matching by
 * encounter ID + service date so re-uploading an overlapping week's report
 * doesn't double-count. When a match recurs, the newly uploaded row normally
 * REPLACES the existing one — claims data for a given claim can get
 * corrected between reports (e.g. a visit type or procedure code fixed in a
 * later week's export). Rows without an encounter ID can't be matched and
 * are always appended.
 *
 * IMPORTANT: matching is by (encounter ID, service date) together, NOT
 * encounter ID alone. Real exports have shown the same external_encounter_id
 * reused across genuinely different real visits for the same patient on
 * different dates (confirmed against an RCM ground-truth report — three
 * separate claim IDs, three different dates, one shared encounter ID).
 * Deduping by encounter ID alone silently collapsed those into a single
 * claim, dropping real revenue. A correction to the same claim keeps the
 * same service date; a different date means a different claim.
 *
 * Within a genuine match, uploads aren't guaranteed to happen in
 * chronological report order (someone may re-drop an old file after a newer
 * one), so "whichever upload came last" isn't a safe recency signal on its
 * own. Real exports have shown the same claim first billed under a generic
 * eval/therapy code, then corrected to H0038 (coaching) in a later report —
 * never the reverse. So once a claim is known to be a coaching claim, a
 * non-coaching version of it is treated as the stale pre-correction state
 * and never overwrites it, regardless of which file was uploaded more
 * recently.
 */
function mergeClaimsRows(existingRows: AppointmentRow[], newRows: AppointmentRow[]): { rows: AppointmentRow[]; updatedCount: number } {
  const rows = [...existingRows];
  const indexByClaimKey = new Map<string, number>();
  rows.forEach((row, i) => {
    const key = claimKey(row);
    if (key) indexByClaimKey.set(key, i);
  });

  let updatedCount = 0;
  for (const row of newRows) {
    const key = claimKey(row);
    const existingIndex = key ? indexByClaimKey.get(key) : undefined;
    if (existingIndex !== undefined) {
      const existingRow = rows[existingIndex];
      const isStaleDowngrade = isCoachingProcedureCode(existingRow.procedureCode) && !isCoachingProcedureCode(row.procedureCode);
      if (!isStaleDowngrade) {
        rows[existingIndex] = row;
      }
      updatedCount += 1;
      continue;
    }
    if (key) indexByClaimKey.set(key, rows.length);
    rows.push(row);
  }

  return { rows, updatedCount };
}

/**
 * Merge freshly parsed registered-patient rows, deduping by userId — a
 * simpler matching key than claims, since there's no service date or
 * procedure-code correction concept for a registration record.
 */
function mergeRegisteredPatients(
  existingPatients: RegisteredPatientRow[],
  newPatients: RegisteredPatientRow[]
): { registeredPatients: RegisteredPatientRow[]; updatedCount: number } {
  const registeredPatients = [...existingPatients];
  const indexByUserId = new Map<string, number>();
  registeredPatients.forEach((p, i) => indexByUserId.set(p.userId, i));

  let updatedCount = 0;
  for (const patient of newPatients) {
    const existingIndex = indexByUserId.get(patient.userId);
    if (existingIndex !== undefined) {
      registeredPatients[existingIndex] = patient;
      updatedCount += 1;
      continue;
    }
    indexByUserId.set(patient.userId, registeredPatients.length);
    registeredPatients.push(patient);
  }

  return { registeredPatients, updatedCount };
}

/**
 * Single merge entry point for anything that can be uploaded: a claims
 * report (rows), a registered-users export (registeredPatients), or a full
 * snapshot (both). Whichever of `rows` / `registeredPatients` is present in
 * `parsed` gets merged into the matching part of the existing dataset.
 */
export function mergeIntoDataset(
  existing: ParsedDataset | null,
  fileName: string,
  parsed: { rows?: AppointmentRow[]; registeredPatients?: RegisteredPatientRow[]; skippedCount: number }
): ParsedDataset {
  const claimsResult = mergeClaimsRows(existing?.rows ?? [], parsed.rows ?? []);
  const patientsResult = mergeRegisteredPatients(existing?.registeredPatients ?? [], parsed.registeredPatients ?? []);

  return {
    rows: claimsResult.rows,
    registeredPatients: patientsResult.registeredPatients,
    fileNames: [...(existing?.fileNames ?? []), fileName],
    uploadedAt: new Date().toISOString(),
    rowCount: claimsResult.rows.length,
    skippedCount: (existing?.skippedCount ?? 0) + parsed.skippedCount,
    duplicateCount: (existing?.duplicateCount ?? 0) + claimsResult.updatedCount,
    registeredDuplicateCount: (existing?.registeredDuplicateCount ?? 0) + patientsResult.updatedCount,
  };
}
