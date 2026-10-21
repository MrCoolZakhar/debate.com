// Day arithmetic and date words for the delegation Overview (the Deadlines
// card and the next step). Local days: a bare 'YYYY-MM-DD' is that local day.

export const DAY = 24 * 60 * 60 * 1000;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Midnight of a date, local time. */
export function dayOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function todayStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "12 Mar", with the year when it is not this one. */
export function dayWords(day: number): string {
  const d = new Date(day);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** "today", "tomorrow", "in 5 days", "in 3 weeks", "in 4 months". */
export function relativeWords(day: number, today: number): string {
  const n = Math.round((day - today) / DAY);
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 14) return `in ${n} days`;
  if (n < 60) return `in ${Math.round(n / 7)} weeks`;
  const months = Math.round(n / 30);
  return months <= 1 ? 'in 1 month' : `in ${months} months`;
}

/** "12 to 14 Mar", "28 Feb to 2 Mar", "12 Mar"; the year when it is not this one. */
export function rangeWords(start: number, end: number | null): string {
  if (end === null || end === start) return dayWords(start);
  const a = new Date(start);
  const b = new Date(end);
  const thisYear = new Date().getFullYear();
  const yearB = b.getFullYear() === thisYear ? '' : ` ${b.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}${yearB}`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}${yearB}`;
  return `${dayWords(start)} to ${dayWords(end)}`;
}
