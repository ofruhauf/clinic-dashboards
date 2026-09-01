import type { RegisteredPatientRow } from './types';
import { normalizePayer } from './parseClaimsFile';

// This export comes from the product's own user database (registration/app-usage
// data), not the claims/billing system — it's a much wider, more PHI-heavy file
// (name, email, phone, DOB, IP address, device info, etc.) than the claims export.
// Only userId and clientCompany are read; everything else is ignored on purpose.
const USER_ID_KEY = 'userid';
const COMPANY_KEY = 'clientcompany';

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

/**
 * Cheap check of just the header row to tell a registered-users export apart
 * from a claims report before committing to a parser — both can arrive as
 * .csv or .xlsx, so the file extension alone can't tell them apart.
 */
export async function looksLikeUsersFile(file: File): Promise<boolean> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, sheetRows: 1 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return false;
  const sheet = workbook.Sheets[sheetName];
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (!headerRow) return false;
  const normalized = new Set(headerRow.map((h) => normalizeKey(String(h ?? ''))));
  return normalized.has(USER_ID_KEY) && normalized.has(COMPANY_KEY);
}

export async function parseUsersFile(
  file: File
): Promise<{ registeredPatients: RegisteredPatientRow[]; skippedCount: number }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no data.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const registeredPatients: RegisteredPatientRow[] = [];
  let skippedCount = 0;

  for (const raw of rawRows) {
    let userId = '';
    let companyRaw = '';
    for (const [key, value] of Object.entries(raw)) {
      const normalized = normalizeKey(key);
      if (normalized === USER_ID_KEY) userId = toText(value);
      else if (normalized === COMPANY_KEY) companyRaw = toText(value);
    }

    if (!userId) {
      skippedCount += 1;
      continue;
    }

    registeredPatients.push({
      userId,
      company: companyRaw ? normalizePayer(companyRaw) : null,
    });
  }

  if (registeredPatients.length === 0) {
    throw new Error('No usable rows found. Make sure the file has userId and clientCompany columns with values.');
  }

  return { registeredPatients, skippedCount };
}
