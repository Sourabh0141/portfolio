const monthYear = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

/** Formats a `YYYY-MM` string as e.g. "Nov 2025". */
export function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return monthYear.format(new Date(Date.UTC(year!, month! - 1, 1)));
}

/** "Nov 2025 – Present" or "Jan 2025 – Oct 2025". */
export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;
}
