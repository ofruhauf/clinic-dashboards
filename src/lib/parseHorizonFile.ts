import { monthKey, monthLabel } from './metrics';
import type { HorizonMonthActivity, HorizonServiceType, HorizonUserRow } from './types';

// The sole data source for the Horizon dashboard: the practice's own D2C
// tracking workbook. Only the "Users Tracking" tab is read — the workbook's
// other tabs (Weekly Summary, High Level Daily, OB Flow, Queries, TEMP) are
// ignored. That tab has an unusual shape: two header rows (row 1 names each
// month block, row 2 names the columns within it), a third "summary" row
// carrying aggregate/average formulas rather than a real user, and then one
// real row per registered user. The set of month blocks grows by one each
// time the workbook is re-exported for a new month, so block position is
// never hardcoded — it's detected from the header rows every time.
const SHEET_NAME_KEY = 'userstracking';

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function toText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseYesNo(value: unknown): boolean | null {
  const text = toText(value).toLowerCase();
  if (text === 'yes') return true;
  if (text === 'no') return false;
  return null;
}

async function findUsersTrackingSheet(file: File) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeKey(name) === SHEET_NAME_KEY);
  return { XLSX, workbook, sheetName };
}

/** Cheap check that this workbook has a "Users Tracking" tab before committing to the full parse. */
export async function looksLikeHorizonFile(file: File): Promise<boolean> {
  try {
    const { sheetName } = await findUsersTrackingSheet(file);
    return sheetName != null;
  } catch {
    return false;
  }
}

interface MonthBlock {
  month: string;
  label: string;
  colAppOpened: number;
  colTimeInApp: number;
  colCoaching: number;
  colTherapy: number;
  colValue: number;
}

function detectMonthBlocks(headerRow1: unknown[], headerRow2: unknown[]): MonthBlock[] {
  const blockStarts: number[] = [];
  for (let c = 0; c < headerRow1.length; c++) {
    if (headerRow1[c] instanceof Date) blockStarts.push(c);
  }
  return blockStarts.map((start, i) => {
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : headerRow2.length;
    let colAppOpened = -1;
    let colTimeInApp = -1;
    let colCoaching = -1;
    let colTherapy = -1;
    let colValue = -1;
    for (let c = start; c < end; c++) {
      const label = normalizeKey(headerRow2[c]);
      if (label === 'appopened') colAppOpened = c;
      else if (label === 'timeinapp(hours)' || label === 'timeinapphours') colTimeInApp = c;
      else if (label === 'coachingsessions') colCoaching = c;
      else if (label === 'therapysessions') colTherapy = c;
      else if (label === 'value') colValue = c;
    }
    const month = monthKey(headerRow1[start] as Date);
    return { month, label: monthLabel(month), colAppOpened, colTimeInApp, colCoaching, colTherapy, colValue };
  });
}

function parseServiceSelected(value: unknown): HorizonServiceType | null {
  const text = toText(value).toLowerCase();
  return text === 'evaluation' || text === 'coaching' || text === 'therapy' ? text : null;
}

export async function parseHorizonFile(file: File): Promise<{ users: HorizonUserRow[]; months: string[]; skippedCount: number }> {
  const { XLSX, workbook, sheetName } = await findUsersTrackingSheet(file);
  if (!sheetName) {
    throw new Error('Couldn\'t find a "Users Tracking" tab in this file.');
  }
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (grid.length < 2) {
    throw new Error('The "Users Tracking" tab has no data.');
  }

  const headerRow1 = grid[0] ?? [];
  const headerRow2 = grid[1] ?? [];
  const blocks = detectMonthBlocks(headerRow1, headerRow2);
  const months = blocks.map((b) => b.month);

  const users: HorizonUserRow[] = [];
  let skippedCount = 0;

  for (let r = 2; r < grid.length; r++) {
    const row = grid[r] ?? [];
    if (row.every((v) => v == null)) continue; // fully blank row

    const createdAtRaw = row[0];
    const userId = toText(row[1]);

    // The tab's third row (and any stray repeat) carries header text or
    // summary/average formulas instead of a real user — skip anything
    // without a real Date in column A and a userId in column B.
    if (!(createdAtRaw instanceof Date) || !userId) {
      skippedCount += 1;
      continue;
    }

    const monthly: HorizonMonthActivity[] = blocks.map((b) => ({
      month: b.month,
      label: b.label,
      appOpened: b.colAppOpened >= 0 ? parseYesNo(row[b.colAppOpened]) : null,
      timeInAppHours: b.colTimeInApp >= 0 ? toNumber(row[b.colTimeInApp]) : 0,
      coachingSessions: b.colCoaching >= 0 ? toNumber(row[b.colCoaching]) : 0,
      therapySessions: b.colTherapy >= 0 ? toNumber(row[b.colTherapy]) : 0,
      value: b.colValue >= 0 ? toNumber(row[b.colValue]) : 0,
    }));

    users.push({
      userId,
      createdAt: createdAtRaw,
      serviceSelected: parseServiceSelected(row[2]),
      monthly,
    });
  }

  if (users.length === 0) {
    throw new Error('No usable user rows found in the "Users Tracking" tab.');
  }

  return { users, months, skippedCount };
}
