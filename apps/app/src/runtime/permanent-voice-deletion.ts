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
 * Pure. The caller holds the Notes deletion-effects lock, has read every input after taking
 * it, and applies this only to rows written by an earlier process, so no effect of the
 * interrupted operation can still be in flight.
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
