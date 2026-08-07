export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
export type MonthKey = typeof MONTHS[number];

export function getCurrentMonthForYear(year: number | null, now = new Date()): MonthKey | null {
  if (year !== now.getFullYear()) return null;
  return MONTHS[now.getMonth()] ?? null;
}
