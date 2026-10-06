// en-IN prints "Nov 2025". UTC keeps the 1st of the month from becoming the
// previous evening in timezones behind UTC.
const monthYear = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  // Date months are 0–11. The stored value is 1–12.
  return monthYear.format(new Date(Date.UTC(year!, month! - 1, 1)));
}

// A missing end means the role is still current.
export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;
}
