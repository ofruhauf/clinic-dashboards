export interface AppointmentRow {
  patient: string;
  title: string;
  therapist: string;
  account: string | null; // "insurance" column; null = self-pay / other
  scheduledFor: Date;
  paymentMethod: string | null;
  status: string;
  showUp: boolean | null;
  reported: boolean | null;
  createdAt: Date | null;
}

export interface ParsedDataset {
  rows: AppointmentRow[];
  fileName: string;
  uploadedAt: string; // ISO
  rowCount: number;
  skippedCount: number;
}

export type DateRangePreset =
  | 'all'
  | 'ytd'
  | 'last3'
  | 'last6'
  | 'last12';

export interface DateRange {
  start: Date | null; // inclusive
  end: Date | null; // inclusive
}
