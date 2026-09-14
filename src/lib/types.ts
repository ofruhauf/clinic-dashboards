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
  encounterId: string; // external_encounter_id — combined with scheduledFor to dedupe across
  // uploaded files (not unique on its own; real exports reuse it across different real claims)
}

// From a separate export (the product's own user database), not the claims/billing
// system — identifies who has registered with a payer partner, whether or not
// they've been seen/billed yet. Deliberately minimal: no name, email, phone, DOB,
// or any of the other PHI-adjacent fields that export carries, since a userId +
// company is all this dashboard needs.
export interface RegisteredPatientRow {
  userId: string; // stable id from the product's user database — dedupe key across uploads
  company: string | null; // normalized clientCompany (e.g. "Horizon"); null if blank
  registeredAt: Date | null; // createdAt — when they registered; null if missing/unparseable
}

// Exported directly from the practice's scheduling CRM — every session, past
// and scheduled, with a real show-up outcome and the insurance carrier on
// file. No stable patient ID is available in this export, unlike claims/
// registered-patients, so patient display name is the only identifier for
// unique-patient counts — the same level of PHI the claims export already
// stores for patient names. This is the dashboard's primary source for
// session counts, visit-type breakdown, and show-up rate — richer and more
// current than claims, which only reflects what's been billed so far — and
// its future-dated, non-cancelled rows also power the "booked (upcoming)"
// pipeline (this file replaced a narrower future-only export that served
// only that purpose).
export interface SessionRow {
  patient: string; // display name
  title: string; // visit type (evaluation, therapy, coaching, etc.)
  account: string | null; // normalized insurance carrier; null = none on file
  scheduledFor: Date; // the session's date/time, past or future
  status: string; // raw CRM status (e.g. SCHEDULED, CONFIRMED, CANCELLED)
  showUp: boolean | null; // real outcome for past sessions; null if blank/unparseable or not yet happened
}

export interface ParsedDataset {
  rows: AppointmentRow[];
  registeredPatients: RegisteredPatientRow[];
  sessions: SessionRow[];
  fileNames: string[]; // every file that has contributed rows, in upload order
  uploadedAt: string; // ISO, most recent upload
  rowCount: number;
  skippedCount: number; // cumulative rows skipped (missing patient/date) across all uploads
  duplicateCount: number; // cumulative claims matched to one already loaded (updated or confirmed unchanged)
  registeredDuplicateCount: number; // same, for registered-patient rows (matched by userId)
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
