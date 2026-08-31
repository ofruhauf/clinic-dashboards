export interface AppointmentRow {
  patientId: string; // stable external_patient_id — used for all patient dedup/counting
  patient: string; // display name
  title: string; // appointment_name (visit type — evaluation, therapy, coaching, etc.)
  therapist: string; // rendering provider
  account: string | null; // payer name; null = self-pay
  scheduledFor: Date; // date_of_service
  chargeAmount: number; // actual billed amount, in dollars
  procedureCode: string | null;
  showUp: boolean | null; // not present in claims data; always null, kept so show-up-rate code degrades gracefully
  encounterId: string; // external_encounter_id — used to dedupe across uploaded files
}

export interface ParsedDataset {
  rows: AppointmentRow[];
  fileNames: string[]; // every file that has contributed rows, in upload order
  uploadedAt: string; // ISO, most recent upload
  rowCount: number;
  skippedCount: number; // cumulative rows skipped (missing patient/date) across all uploads
  duplicateCount: number; // cumulative rows skipped as duplicates (same encounter already loaded)
}

export type DateRangePreset =
  | 'all'
  | 'ytd'
  | 'last3'
  | 'last6'
  | 'last12';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'last3', label: 'Last 3 months' },
  { value: 'last6', label: 'Last 6 months' },
  { value: 'last12', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

export interface DateRange {
  start: Date | null; // inclusive
  end: Date | null; // inclusive
}
