import {formatTime, formatShortDate} from './locale-time.ts';

/** What needs attention, from the mail provider adapter (P06 inboxAttention()). */
export interface HomeAttentionSummary {
  state: 'not-connected' | 'loading' | 'ready' | 'stale' | 'error';
  /** Unread messages in the inbox; required when ready, last known value when stale. */
  unread?: number;
  /** Provider or account label, for example "Gmail" or "work@example.com". */
  source?: string;
  /** Epoch milliseconds or ISO time of the last successful read. */
  updatedAt?: number | string;
  /** Provider-supplied failure text for the error state. */
  message?: string;
}
/** Latest retained scheduled brief (P05 latestRetainedDigest()). */
export interface HomeBriefSummary { summary: string; ranAt: string | number; agent: string; status: string }
export type HomeCardAction = 'inbox' | 'connections' | 'calendar' | 'workflows';

const instant = (value: unknown) => { const at = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(at) && at > 0 ? at : null; };
/** "3:04 PM" today, otherwise "Wed, Oct 8 3:04 PM". */
export function whenLabel(at: number, now: number) {
  const date = new Date(at), today = new Date(now);
  return date.toDateString() === today.toDateString() ? formatTime(date) : `${formatShortDate(date)} ${formatTime(date)}`;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function presentHomeAttention(summary: HomeAttentionSummary | null | undefined, now: number) {
  const updated = instant(summary?.updatedAt);
  const source = typeof summary?.source === 'string' && summary.source.trim() ? summary.source.trim().slice(0, 60) : 'Inbox';
  const unread = Number.isSafeInteger(summary?.unread) && Number(summary?.unread) >= 0 ? Number(summary?.unread) : null;
  switch (summary?.state) {
    case 'ready':
      if (unread === null) break;
      return {action: 'inbox' as const, count: String(unread),
        text: `${unread ? 'unread' : 'Nothing unread'} · ${source}${updated ? ` · ${whenLabel(updated, now)}` : ''}`,
        // Stable accessible name; source and read time are in the visible text line.
        label: `Open Inbox: ${plural(unread, 'unread email', 'unread emails')}`};
    case 'stale':
      return {action: 'inbox' as const, count: unread === null ? '—' : String(unread),
        text: updated ? `Not updated since ${whenLabel(updated, now)}` : 'Not updated recently',
        label: `Open Inbox: ${source} has not updated${updated ? ` since ${whenLabel(updated, now)}` : ''}${unread === null ? '' : `; ${plural(unread, 'unread email', 'unread emails')} when last read`}`};
    case 'error': {
      const message = typeof summary.message === 'string' && summary.message.trim() ? summary.message.trim().slice(0, 120) : `${source} could not be checked`;
      return {action: 'inbox' as const, count: '!', text: message, label: `Open Inbox to retry: ${message}`};
    }
    case 'loading':
      return {action: 'inbox' as const, count: '…', text: `Checking ${source}…`, label: `Open Inbox: checking ${source}`};
  }
  return {action: 'connections' as const, count: '—', text: 'Set up Gmail', label: 'Set up Gmail in Connections to see what needs your attention'};
}

export function presentHomeBrief(brief: HomeBriefSummary | null | undefined, now: number) {
  const summary = typeof brief?.summary === 'string' ? brief.summary.replace(/\s+/g, ' ').trim() : '';
  const ran = instant(brief?.ranAt);
  if (!brief || !summary || !ran) return {title: 'No brief yet', time: 'Workflows', source: '', label: 'Open workflows', has: false};
  const agent = typeof brief.agent === 'string' && brief.agent.trim() ? brief.agent.trim().slice(0, 40) : 'Your agent';
  const failed = typeof brief.status === 'string' && /fail|error|cancel/i.test(brief.status);
  const title = summary.length > 56 ? `${summary.slice(0, 55).trimEnd()}…` : summary;
  return {title, time: `${failed ? 'Failed' : 'Ran'} ${whenLabel(ran, now)}`, source: agent, has: true,
    label: `Open workflows. Latest brief from ${agent}, ${failed ? 'failed' : 'ran'} ${whenLabel(ran, now)}: ${summary.slice(0, 280)}`};
}

/** Calendar adapter status strings (calendar-adapter nativeCalendarStatus) mapped to card states. */
export type CalendarCardState = 'ready' | 'loading' | 'denied' | 'error' | 'unavailable' | 'not-connected';
export function calendarCardState(status: unknown): CalendarCardState {
  const text = typeof status === 'string' ? status : '';
  if (/denied/i.test(text)) return 'denied';
  if (/could not be loaded|failed|unavailable\b/i.test(text)) return 'error';
  if (/^Loading/i.test(text)) return 'loading';
  if (/connected|limited/i.test(text) && !/^Not connected/i.test(text)) return 'ready';
  if (/available in the Android app/i.test(text)) return 'unavailable';
  return 'not-connected';
}
export interface HomeAgenda { title: string; begin: number; allDay: boolean; video: boolean; people: string[]; overdue?: boolean }
export function presentHomeCalendar(input: {state: CalendarCardState; agenda: HomeAgenda | null; readAt: number | null; now: number; device: string}) {
  const {state, agenda, readAt, now, device} = input;
  const source = state === 'ready' && readAt ? `Read ${whenLabel(readAt, now)} from ${device}` : '';
  if (agenda) {
    const date = new Date(agenda.begin);
    const time = agenda.overdue ? 'Overdue' : agenda.begin <= now ? (agenda.allDay ? 'All day' : 'Now')
      : date.toDateString() === new Date(now).toDateString() ? (agenda.allDay ? 'All day' : formatTime(date)) : formatShortDate(date);
    // Accessible names stay stable ("Open calendar event: <title>" / "Open your calendar"); the
    // visible time, state and source lines carry the rest.
    return {title: agenda.title, time, source, video: agenda.video, people: agenda.people, label: `Open calendar event: ${agenda.title}`};
  }
  const empty = (title: string, time: string) => ({title, time, source, video: false, people: [] as string[], label: 'Open your calendar'});
  switch (state) {
    case 'denied': return empty('Calendar access is off', 'Access denied');
    case 'error': return empty('Calendar could not be read', 'Tap to retry');
    case 'loading': return empty('Reading your calendar…', 'Calendar');
    case 'ready': return empty('Nothing coming up', 'Calendar');
    case 'unavailable': return empty('Your calendar', 'Calendar');
  }
  return empty('Connect your calendar', 'Calendar');
}
/** At most three attendee initials, with a "+N" overflow, derived only from event attendee names. */
export function attendeeInitials(names: unknown[]): string[] {
  const initials = names.filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => {
    const parts = name.trim().replace(/[<(].*$/, '').trim().split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase();
  }).filter(Boolean);
  return initials.length > 3 ? [...initials.slice(0, 2), `+${initials.length - 2}`] : initials;
}
