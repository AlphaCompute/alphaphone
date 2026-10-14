/**
 * Calendar days side by side on a wide canvas (#411, responsive-surface matrix: "More visible
 * time/day columns if readable; keep agenda fallback at large text"). The number of days comes from
 * the measured canvas width and text size (runtime/canvas-geometry.ts). Each column is the same
 * per-day layout the single-day timeline uses, so event identity, the opened occurrence and its
 * time zone never change with the window; only the lanes are drawn as fractions of the column.
 */
import { currentSurfaceLayout } from '../runtime/canvas-geometry';
type Bag = Record<string, any>;

/** The per-day layout lays lanes out across a 336px reference column starting at 60px. */
const REFERENCE_LEFT = 60, REFERENCE_WIDTH = 336;

export const calendarDayCount = (): number => currentSurfaceLayout().calendarDays;
export const visibleCalendarDays = (day: number, count = calendarDayCount()): number[] => Array.from({ length: count }, (_, index) => day + index);

export function calendarDayLabel(now: Date | number, off: number): string {
  const date = new Date(now); date.setDate(date.getDate() + off);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/** Template rows for each visible day; `showNow` marks today's column when now is on the timeline. */
export function calendarDayColumns(columns: Array<{ off: number; events: Bag[] }>, now: Date | number, nowTop: number, nowVisible: boolean) {
  return columns.map(({ off, events }) => ({
    label: calendarDayLabel(now, off), isToday: off === 0, showNow: off === 0 && nowVisible, nowTop,
    events: events.map(event => ({ ...event, x: ((event.left - REFERENCE_LEFT) / REFERENCE_WIDTH * 100).toFixed(3), wp: ((event.w + 4) / REFERENCE_WIDTH * 100).toFixed(3) })),
  }));
}

/** The week strip shows which of its days are on screen as columns. */
export function markVisibleWeek(week: Bag[], weekStart: number, day: number, count: number): Bag[] {
  if (count < 2) return week;
  return week.map((item, index) => { const off = weekStart + index; return off > day && off < day + count && off !== 0 ? { ...item, cs: `${item.cs || ''};background:var(--s2)` } : item; });
}
