/**
 * Opaque agent-context revision for a selected SIM. It changes when the slot or carrier changes
 * but never carries the carrier display name, and always matches the shared identifier grammar.
 */
export function smsSubscriptionRevision(sim: { slot: number; carrierName: string }): string {
  let hash = 0x811c9dc5;
  for (const char of `${sim.slot}\u0000${sim.carrierName}`) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return `slot${sim.slot}-${hash.toString(16).padStart(8, '0')}`;
}
