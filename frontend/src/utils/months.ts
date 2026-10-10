export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
export type MonthKey = typeof MONTHS[number];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export function getCurrentMonthForYear(year: number | null, now = new Date()): MonthKey | null {
  if (year !== now.getFullYear()) return null;
  return MONTHS[now.getMonth()] ?? null;
}
