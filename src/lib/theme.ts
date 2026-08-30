// Validated categorical palette (fixed order — see dataviz skill palette.md).
// First 4 slots for stacked/grouped series; all 8 available for wider category sets
// (therapist / account breakdowns), always paired with a visible legend per the
// palette's contrast-relief rule.
export const SERIES_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const;

export const CHART_SURFACE = '#fcfcfb';
export const PAGE_PLANE = '#f9f9f7';
export const INK_PRIMARY = '#0b0b0b';
export const INK_SECONDARY = '#52514e';
export const INK_MUTED = '#898781';
export const GRIDLINE = '#e1e0d9';
export const AXIS_LINE = '#c3c2b7';
export const GOOD = '#006300';
export const CRITICAL = '#d03b3b';

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
