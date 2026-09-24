// Single source of truth for the Horizon dashboard: the "Users Tracking" tab
// of the practice's own D2C tracking workbook. One row per registered user,
// keyed by an opaque product userId (no name — nothing further to minimize
// for PHI), with a repeating block of monthly activity columns that grows
// each month the workbook is re-exported.

export type HorizonServiceType = 'evaluation' | 'coaching' | 'therapy';

export interface HorizonMonthActivity {
  month: string; // "2026-07"
  label: string; // "Jul 2026"
  appOpened: boolean | null; // "Yes"/"No" for that month; null if blank
  timeInAppHours: number;
  coachingSessions: number;
  therapySessions: number;
  value: number; // dollars recognized that month, per the workbook
}

export interface HorizonUserRow {
  userId: string;
  createdAt: Date; // registration date
  serviceSelected: HorizonServiceType | null; // the service they signed up for; null if blank/unrecognized
  monthly: HorizonMonthActivity[]; // one entry per month block found in the workbook, chronological
}

export interface HorizonDataset {
  users: HorizonUserRow[];
  months: string[]; // every month key found in the workbook, chronological — the shared x-axis for all charts
  fileName: string;
  uploadedAt: string; // ISO, most recent upload
  rowCount: number;
  skippedCount: number; // rows skipped (missing userId or an unparseable creation date)
}

export type DateRangePreset = 'all' | 'ytd' | 'last3' | 'last6' | 'last12';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'last3', label: 'Last 3 months' },
  { value: 'last6', label: 'Last 6 months' },
  { value: 'last12', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];
