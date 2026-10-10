/** The calendar event whose location was handed to Maps. It lives only in the Maps view state for
 * that visit: it is not persisted, carries no location or search text, and never replays a search. */
export type MapsEventOrigin = { version: 1; id: string; begin: number; rowId: string; day: number; title: string };
type Bag = Record<string, any>;

export function mapsEventOriginOf(value: unknown): MapsEventOrigin | undefined {
  const o = value as MapsEventOrigin | undefined;
  if (!o || typeof o !== 'object' || o.version !== 1 || typeof o.id !== 'string' || !o.id || o.id.length > 256 || !Number.isSafeInteger(o.begin)
    || typeof o.rowId !== 'string' || !o.rowId || o.rowId.length > 512 || !Number.isSafeInteger(o.day) || typeof o.title !== 'string' || o.title.length > 2048) return;
  return { version: 1, id: o.id, begin: o.begin, rowId: o.rowId, day: o.day, title: o.title };
}
/** Built from the event row whose detail page is open when its location is tapped. */
export function mapsEventOriginFor(row: unknown, day: unknown): MapsEventOrigin | undefined {
  const r = row as Bag | undefined;
  if (!r || r.alphaCalendarId === undefined || r.alphaCalendarId === null || !r.nativeEvent) return;
  return mapsEventOriginOf({ version: 1, id: String(r.alphaCalendarId), begin: r.nativeEvent.begin, rowId: r.id, day: Number.isSafeInteger(day) ? day : r.off, title: String(r.title || '').slice(0, 2048) });
}
/** "Back to event" is offered only while Calendar is the view Maps was opened from. */
export function mapsEventReturnOffered(value: unknown, stack: unknown, navigating: boolean): MapsEventOrigin | undefined {
  const origin = mapsEventOriginOf(value);
  return origin && !navigating && Array.isArray(stack) && stack.length > 0 && stack[stack.length - 1] === 'calendar' ? origin : undefined;
}
/** Fails closed: exactly one current event must have the stored identity and start. */
export function mapsEventStillThere(value: unknown, events: unknown): boolean {
  const origin = mapsEventOriginOf(value);
  return !!origin && Array.isArray(events) && events.filter((e: Bag) => e && String(e.id) === origin.id && e.begin === origin.begin).length === 1;
}
