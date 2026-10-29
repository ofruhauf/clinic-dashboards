import { monthLabel } from './metrics';
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
  colCoachMsgMinutes: number;
  colOtherInAppMinutes: number;
  colCoaching: number;
  colTherapy: number;
  colValue: number;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Each month block's start column, in left-to-right (chronological) order.
 * Two header styles have shown up in the wild: an actual Excel date in row 1
 * (the month's own year included), and a plain month-name string with no
 * year at all (e.g. "October") — the workbook switched from the former to
 * the latter between exports, so both are supported.
 */
function findBlockStarts(headerRow1: unknown[]): { start: number; monthIndex: number; year: number | null }[] {
  const blocks: { start: number; monthIndex: number; year: number | null }[] = [];
  for (let c = 0; c < headerRow1.length; c++) {
    const cell = headerRow1[c];
    if (cell instanceof Date) {
      blocks.push({ start: c, monthIndex: cell.getUTCMonth(), year: cell.getUTCFullYear() });
      continue;
    }
    if (typeof cell === 'string') {
      const idx = MONTH_NAMES.indexOf(cell.trim().toLowerCase());
      if (idx >= 0) blocks.push({ start: c, monthIndex: idx, year: null });
    }
  }
  return blocks;
}

/**
 * Fills in the year for any block whose header only gave a month name.
 * Blocks are always consecutive calendar months left to right, so once the
 * last year-less block is anchored to the most recent real occurrence of
 * its month at/before `now`, every earlier block is exactly one calendar
 * month before the block right after it.
 */
function resolveBlockYears(
  blocks: { start: number; monthIndex: number; year: number | null }[],
  now: Date
): number[] {
  const years = blocks.map((b) => b.year);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (years[i] != null) continue;
    if (i === blocks.length - 1) {
      let year = now.getUTCFullYear();
      if (blocks[i].monthIndex > now.getUTCMonth()) year -= 1;
      years[i] = year;
    } else {
      const d = new Date(Date.UTC(years[i + 1]!, blocks[i + 1].monthIndex - 1, 1));
      years[i] = d.getUTCFullYear();
    }
  }
  return years as number[];
}

function detectMonthBlocks(headerRow1: unknown[], headerRow2: unknown[], now: Date): MonthBlock[] {
  const rawBlocks = findBlockStarts(headerRow1);
  const years = resolveBlockYears(rawBlocks, now);

  return rawBlocks.map((b, i) => {
    const end = i + 1 < rawBlocks.length ? rawBlocks[i + 1].start : headerRow2.length;
    let colAppOpened = -1;
    let colTimeInApp = -1;
    let colCoachMsgMinutes = -1;
    let colOtherInAppMinutes = -1;
    let colCoaching = -1;
    let colTherapy = -1;
    let colValue = -1;
    for (let c = b.start; c < end; c++) {
      const label = normalizeKey(headerRow2[c]);
      if (label === 'appopened') colAppOpened = c;
      else if (label === 'timeinapp(hours)' || label === 'timeinapphours') colTimeInApp = c;
      else if (label === 'coachmessagingminutes') colCoachMsgMinutes = c;
      else if (label === 'otherinappminutes') colOtherInAppMinutes = c;
      else if (label === 'coachingsessions') colCoaching = c;
      else if (label === 'therapysessions') colTherapy = c;
      else if (label === 'value') colValue = c;
    }
    const month = `${years[i]}-${String(b.monthIndex + 1).padStart(2, '0')}`;
    return {
      month,
      label: monthLabel(month),
      colAppOpened,
      colTimeInApp,
      colCoachMsgMinutes,
      colOtherInAppMinutes,
      colCoaching,
      colTherapy,
      colValue,
    };
  });
}

function parseServiceSelected(value: unknown): HorizonServiceType | null {
  const text = toText(value).toLowerCase();
  return text === 'evaluation' || text === 'coaching' || text === 'therapy' ? text : null;
}

export async function parseHorizonFile(
  file: File,
  now: Date = new Date()
): Promise<{ users: HorizonUserRow[]; months: string[]; skippedCount: number }> {
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
  const blocks = detectMonthBlocks(headerRow1, headerRow2, now);
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

    const monthly: HorizonMonthActivity[] = blocks.map((b) => {
      // "Time in App (Hours)" was later split into two separate minutes
      // columns (coach messaging vs. everything else in-app) — combine them
      // back into hours when that's what the workbook gives us, otherwise
      // fall back to the original single-column export.
      const timeInAppHours =
        b.colCoachMsgMinutes >= 0 || b.colOtherInAppMinutes >= 0
          ? (toNumber(row[b.colCoachMsgMinutes]) + toNumber(row[b.colOtherInAppMinutes])) / 60
          : b.colTimeInApp >= 0
            ? toNumber(row[b.colTimeInApp])
            : 0;
      return {
        month: b.month,
        label: b.label,
        appOpened: b.colAppOpened >= 0 ? parseYesNo(row[b.colAppOpened]) : null,
        timeInAppHours,
        coachMessagingMinutes: b.colCoachMsgMinutes >= 0 ? toNumber(row[b.colCoachMsgMinutes]) : 0,
        coachingSessions: b.colCoaching >= 0 ? toNumber(row[b.colCoaching]) : 0,
        therapySessions: b.colTherapy >= 0 ? toNumber(row[b.colTherapy]) : 0,
        value: b.colValue >= 0 ? toNumber(row[b.colValue]) : 0,
      };
    });

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
