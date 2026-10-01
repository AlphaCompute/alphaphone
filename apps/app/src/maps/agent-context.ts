/** Process-local capability for a Maps observation, never a geographic identifier.
 * The registry stores no query, label, coordinate, provider ID or account ID. */
export type MapsSelectedObject = Readonly<{ kind: 'map-place' | 'map-route' | 'map-search'; id: string; revision: string }>;
let current: MapsSelectedObject | undefined;
let identity: unknown;
export function publishMapsSelection(kind: MapsSelectedObject['kind'], owner: object, revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid Maps observation revision.');
  const id = current?.kind === kind && identity === owner ? current.id : `maps_${crypto.randomUUID()}`;
  identity = owner;
  current = Object.freeze({ kind, id, revision: String(revision) });
}
export function clearMapsSelection(): void { current = undefined; identity = undefined; }
export function getMapsSelectedObject(): MapsSelectedObject | undefined { return current ? { ...current } : undefined; }
export function validateMapsSelectedObject(value: { kind: string; id: string; revision?: string; accountId?: string }): boolean {
  return !!current && value.accountId === undefined && value.kind === current.kind && value.id === current.id && value.revision === current.revision;
}
