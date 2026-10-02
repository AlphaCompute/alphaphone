import type { Reminder } from '../daily';

type Recurrence = NonNullable<Reminder['recurrence']>;
const DAY = 86_400_000, MINUTE = 60_000;
function civil(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw Error('Invalid reminder date or time.');
  const value = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 16) !== `${date}T${time}`) throw Error('Invalid reminder date or time.');
  return value;
}
function clock(zone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  return (instant: number) => {
    const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    return Date.parse(`${p.year.padStart(4, '0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  };
}
/** Earlier instant at overlaps; future gaps advance to the first valid wall time,
 * matching ReminderStore. All calculations use the saved zone, never the host zone. */
function resolveWall(wall: number, local: ReturnType<typeof clock>, allowGap: boolean): number {
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = wall + hours * 3_600_000;
    offsets.add(local(probe) - probe);
  }
  const candidates = [...offsets].map(offset => wall - offset).sort((a, b) => a - b);
  const exact = candidates.find(instant => local(instant) === wall);
  if (exact !== undefined) return exact;
  if (!allowGap) throw Error('This local time does not exist.');
  // Search only the transition bracket. This also handles half-hour and skipped-day gaps.
  for (let instant = candidates[0]; instant <= candidates[candidates.length - 1]; instant += MINUTE) {
    if (local(instant) >= wall) return instant;
  }
  throw Error('Unable to resolve reminder time.');
}
function validate(rule: Recurrence) {
  if (!['daily', 'weekdays', 'weekly'].includes(rule.rule) || !Number.isInteger(rule.leadMinutes) || rule.leadMinutes < 0 || rule.leadMinutes > 10080) throw Error('Invalid reminder repeat rule.');
  return { wall: civil(rule.date, rule.time), local: clock(rule.zone) };
}
export function initialReminderDue(rule: Recurrence, at: number): number {
  const { wall, local } = validate(rule);
  if (rule.rule === 'weekdays' && [0, 6].includes(new Date(wall).getUTCDay())) throw Error('Choose a weekday for the first occurrence.');
  const dueAt = resolveWall(wall, local, false);
  if (dueAt - rule.leadMinutes * MINUTE !== at) throw Error('Repeat time does not match reminder time.');
  return dueAt;
}
export function nextReminderOccurrence(rule: Recurrence, now: number) {
  const { wall, local } = validate(rule);
  if (!Number.isSafeInteger(now)) throw Error('Invalid reminder clock.');
  let day = wall, skippedDates = 0;
  // Bound corrupt or centuries-old imported state without committing a partial decision.
  for (let count = 0; count < 40_000; count++) {
    day += (rule.rule === 'weekly' ? 7 : 1) * DAY;
    if (rule.rule === 'weekdays') while ([0, 6].includes(new Date(day).getUTCDay())) day += DAY;
    const dueAt = resolveWall(day, local, true), at = dueAt - rule.leadMinutes * MINUTE;
    if (at > now) return { dueAt, at, date: new Date(day).toISOString().slice(0, 10), skippedDates };
    skippedDates++;
  }
  throw Error('Reminder schedule is too old. Review its date.');
}
