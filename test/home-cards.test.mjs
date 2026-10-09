import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const L = await import('../apps/app/src/prototype/locale-time.ts');
const H = await import('../apps/app/src/prototype/home-cards.ts');
L.setLocalePreferences({locale: 'en-US'});
const now = new Date(2026, 9, 7, 15, 30).getTime();
const at = (h, m = 0, day = 7) => new Date(2026, 9, day, h, m).getTime();

test('attention: not connected offers Gmail setup in Connections instead of a dead end', () => {
  for (const summary of [null, undefined, {state: 'not-connected'}, {state: 'ready'}]) {
    const card = H.presentHomeAttention(summary, now);
    assert.equal(card.action, 'connections');
    assert.equal(card.text, 'Set up Gmail');
    assert.doesNotMatch(card.label, /Accounts are not connected/);
  }
});
test('attention: connected shows the unread count, source and read time and opens Inbox', () => {
  const card = H.presentHomeAttention({state: 'ready', unread: 3, source: 'Gmail', updatedAt: at(15, 4)}, now);
  assert.deepEqual(card, {action: 'inbox', count: '3', text: 'unread · Gmail · 3:04 PM', label: 'Open Inbox: 3 unread emails in Gmail, updated 3:04 PM'});
  assert.equal(H.presentHomeAttention({state: 'ready', unread: 0, source: 'Gmail', updatedAt: new Date(at(9)).toISOString()}, now).text, 'Nothing unread · Gmail · 9:00 AM');
  assert.equal(H.presentHomeAttention({state: 'ready', unread: 1, source: 'Gmail'}, now).label, 'Open Inbox: 1 unread email in Gmail');
});
test('attention: stale and error states are explicit and still open Inbox for recovery', () => {
  const stale = H.presentHomeAttention({state: 'stale', unread: 2, source: 'Gmail', updatedAt: at(8, 15, 6)}, now);
  assert.equal(stale.action, 'inbox'); assert.equal(stale.count, '2');
  assert.equal(stale.text, 'Not updated since Tue, Oct 6 8:15 AM');
  const error = H.presentHomeAttention({state: 'error', source: 'Gmail', message: 'Gmail authorization expired'}, now);
  assert.deepEqual(error, {action: 'inbox', count: '!', text: 'Gmail authorization expired', label: 'Open Inbox to retry: Gmail authorization expired'});
  assert.equal(H.presentHomeAttention({state: 'error'}, now).text, 'Inbox could not be checked');
  assert.equal(H.presentHomeAttention({state: 'loading', source: 'Gmail'}, now).count, '…');
});
test('brief: latest retained digest shows its summary, run time and agent; otherwise "No brief yet"', () => {
  assert.deepEqual(H.presentHomeBrief(null, now), {title: 'No brief yet', time: 'Workflows', source: '', label: 'Open workflows', has: false});
  assert.equal(H.presentHomeBrief({summary: '', ranAt: at(7), agent: 'Alpha', status: 'succeeded'}, now).title, 'No brief yet');
  const brief = H.presentHomeBrief({summary: 'Two meetings today and one reply to send.', ranAt: new Date(at(7, 2)).toISOString(), agent: 'Alpha', status: 'succeeded'}, now);
  assert.equal(brief.title, 'Two meetings today and one reply to send.');
  assert.equal(brief.time, 'Ran 7:02 AM'); assert.equal(brief.source, 'Alpha');
  assert.match(brief.label, /^Open workflows\. Latest brief from Alpha, ran 7:02 AM: Two meetings/);
  const long = H.presentHomeBrief({summary: 'x'.repeat(200), ranAt: at(7), agent: '', status: 'failed'}, now);
  assert.ok(long.title.length <= 56 && long.title.endsWith('…'));
  assert.equal(long.time, 'Failed 7:00 AM'); assert.equal(long.source, 'Your agent');
});
test('calendar: status strings map to explicit card states', () => {
  assert.equal(H.calendarCardState('Calendar access denied'), 'denied');
  assert.equal(H.calendarCardState('Calendar range could not be loaded. Open device calendars to retry.'), 'error');
  assert.equal(H.calendarCardState('Browser calendar could not be loaded. Retry or open Calendar recovery.'), 'error');
  assert.equal(H.calendarCardState('Loading calendars…'), 'loading');
  assert.equal(H.calendarCardState('Device calendars connected'), 'ready');
  assert.equal(H.calendarCardState('Calendar range limited to 2,000 events'), 'ready');
  assert.equal(H.calendarCardState('Device calendars are available in the Android app.'), 'unavailable');
  for (const status of ['Not connected', 'Connect device calendars', undefined]) assert.equal(H.calendarCardState(status), 'not-connected');
});
test('calendar: denied, error and retry copy replace neutral copy, and reads name their source', () => {
  const base = {agenda: null, readAt: at(15, 4), now, device: 'this device'};
  assert.deepEqual(H.presentHomeCalendar({...base, state: 'denied'}).title, 'Calendar access is off');
  assert.equal(H.presentHomeCalendar({...base, state: 'denied'}).source, '');
  assert.deepEqual([H.presentHomeCalendar({...base, state: 'error'}).title, H.presentHomeCalendar({...base, state: 'error'}).time], ['Calendar could not be read', 'Tap to retry']);
  const ready = H.presentHomeCalendar({...base, state: 'ready'});
  assert.deepEqual([ready.title, ready.source], ['Nothing coming up', 'Read 3:04 PM from this device']);
  const event = H.presentHomeCalendar({...base, state: 'ready', agenda: {title: 'Dentist', begin: at(16), allDay: false, video: false, people: []}});
  assert.deepEqual([event.title, event.time, event.video, event.source], ['Dentist', '4:00 PM', false, 'Read 3:04 PM from this device']);
  assert.equal(H.presentHomeCalendar({...base, state: 'ready', agenda: {title: 'Trip', begin: at(0, 0, 9), allDay: true, video: true, people: []}}).time, 'Fri, Oct 9');
});
test('attendee initials come only from event names, capped with an overflow count', () => {
  assert.deepEqual(H.attendeeInitials([]), []);
  assert.deepEqual(H.attendeeInitials(['Ada Lovelace', 'grace hopper', 42, '']), ['AL', 'GH']);
  assert.deepEqual(H.attendeeInitials(['A B', 'C D', 'E F', 'G H', 'I J']), ['AB', 'CD', '+3']);
  const template = readFileSync(new URL('../apps/app/src/prototype/template.html', import.meta.url), 'utf8');
  assert.doesNotMatch(template, />(MC|JP|\+2)<\/span>/, 'no hard-coded avatar initials');
  assert.doesNotMatch(template, /\{\{lockSum\}\}|\{\{showHeads\}\}/, 'no fixture lock summary or heads-up banner');
  assert.match(template, /<sc-if value="\{\{homeCalendarVideo\}\}"[^>]*><svg[^>]*><path d="\{\{ic\.video\}\}">/, 'video icon only with a meeting link');
});
