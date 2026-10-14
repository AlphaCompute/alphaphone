/**
 * Startup backstop for a permanent voice deletion (a full Trash refused the restorable copy
 * and the person confirmed "Delete forever without Trash") that process death interrupted.
 *
 * The deletion has two separately durable effects, the note's tombstone and its recording,
 * and no Trash row. Its recovery row is the only record of the confirmed intent. This module
 * decides, from authoritative readback only, the single next step that either finishes the
 * confirmed deletion or returns to the state before it. It never guesses: any evidence that
 * the note or the recording now belongs to something else leaves the row under review.
 *
 * The plan is pure. The caller holds the Notes deletion-effects lock, has read every input
 * after taking it, and applies this only to rows written by an earlier process (and, in the
 * browser, not claimed by a live view), so no effect of the interrupted operation can still be
 * in flight. The lease and claim helpers at the end of this module are not pure.
 */
export type PermanentDeletionEvidence={
 /**
  * Saved Notes readback for the reviewed record: `deleted` only when this operation's own
  * tombstone for the exact reviewed revision is present, `original` only when the exact
  * reviewed revision is still saved, `changed` for everything else (edited, restored as a
  * different revision, deleted by another operation, a reset collection).
  */
 note:'deleted'|'original'|'changed';
 /** Recording metadata readback, or null when it could not be read. */
 recording:{ownedByNote:boolean;inAudioTrash:boolean}|null;
 /** This operation's own receipt on that recording, or null when it could not be read. */
 receipt:'unknown'|'removed'|'restored'|'purged'|null;
 /** A saved note other than the reviewed one references this recording. */
 referencedElsewhere:boolean;
};
/**
 * - `retire`: nothing is left to do; only the recovery row goes.
 * - `erase`: the tombstone is committed and this operation owns the audio trash; erase and retire.
 * - `trash-then-erase`: the tombstone is committed and the recording was never moved; move it
 *   to the audio trash under this operation, erase it, retire.
 * - `restore-recording`: the note was never deleted but this operation holds its recording in
 *   the audio trash; give it back and retire (rollback).
 * - `delete-note`: this operation already erased the recording but the exact reviewed note is
 *   still saved; commit its tombstone and retire.
 * - `review`: ownership is not exact. Nothing is changed and the row stays.
 */
export type PermanentDeletionStep='retire'|'erase'|'trash-then-erase'|'restore-recording'|'delete-note'|'review';

export function planInterruptedPermanentDeletion(evidence:PermanentDeletionEvidence):PermanentDeletionStep{
 const {note,recording,receipt}=evidence;
 if(note==='changed'||!recording||!recording.ownedByNote||receipt===null)return 'review';
 if(note==='deleted'){
  // The recording of a deleted note is erased only while no saved note points at it.
  if(evidence.referencedElsewhere)return 'review';
  if(receipt==='purged')return 'retire';
  if(receipt==='removed')return recording.inAudioTrash?'erase':'review';
  // Never moved. In the audio trash without this operation's receipt means another deletion owns it.
  if(receipt==='unknown')return recording.inAudioTrash?'review':'trash-then-erase';
  // `restored`: a restore of this deletion was started; that operation never deletes again.
  return 'review';
 }
 // The exact reviewed note is still saved.
 if(receipt==='purged')return 'delete-note';
 if(receipt==='removed')return recording.inAudioTrash?'restore-recording':'review';
 // `unknown` (never dispatched) or `restored` (a restore already gave it back): live recording, saved note.
 return recording.inAudioTrash?'review':'retire';
}

/**
 * Renderer-held lease on a deletion recovery row (MVP-15). The Android native passes (the 6-hour
 * WorkManager job and the plugin-load pass) cannot take this renderer's Web Lock, so a live renderer
 * marks each row it is between steps on, or still shows under review with its Restore button, with
 * `lease.until`. The native passes leave a leased row exactly as it is and may finish it only after
 * the lease has expired (NotesDeletionLease.java). The lease is renewed on every step and on every
 * deletion-status pass, which Trash maintenance repeats at least every 15 minutes while the shell
 * is alive, so it outlives the gap between passes and expires soon after the renderer is gone.
 */
export const PERMANENT_DELETION_LEASE_MS=20*60*1000;
export type DeletionLease={until:number};
/** The row with a lease running from now. Nothing else in the row changes. */
export function leasedDeletionRow<T extends object>(row:T,now:number):T&{lease:DeletionLease}{
 return {...row,lease:{until:now+PERMANENT_DELETION_LEASE_MS}};
}
/** The same deletion row, whatever its lease. */
export function sameDeletionRow(a:object,b:object):boolean{
 return JSON.stringify({...a,lease:undefined})===JSON.stringify({...b,lease:undefined});
}
/** True when the row's lease is due for renewal: absent, malformed, or less than half left. */
export function deletionLeaseDue(row:object,now:number):boolean{
 const until=(row as {lease?:Partial<DeletionLease>}).lease?.until;
 return typeof until!=='number'||!Number.isFinite(until)||until-now<PERMANENT_DELETION_LEASE_MS/2;
}

/**
 * Origin-wide claim on the deletions a live view started. Each view holds a shared Web Lock per
 * row it started until the row retires or the view goes away (the browser releases it then).
 * Another tab never settles a row that a live view still holds; per-process bookkeeping alone
 * could not tell such a row from one an earlier, closed view left.
 */
const claimPrefix='alpha.notes-deletion-claim.v1:';
const claims=new Map<string,()=>void>();
export function claimDeletion(id:string):void{
 if(claims.has(id)||!navigator.locks?.request)return;
 let release:()=>void=()=>{};
 const held=new Promise<void>(resolve=>{release=resolve;});
 claims.set(id,release);
 void navigator.locks.request(claimPrefix+id,{mode:'shared'},()=>held).catch(()=>{claims.delete(id);});
}
export function releaseDeletionClaim(id:string):void{claims.get(id)?.();claims.delete(id);}
/** True when another live view of this origin holds the claim on this row. */
export async function deletionClaimedElsewhere(id:string):Promise<boolean>{
 if(claims.has(id)||!navigator.locks?.query)return false;
 const state=await navigator.locks.query();
 return [...(state.held||[]),...(state.pending||[])].some(lock=>lock.name===claimPrefix+id);
}
