import { reviewMailAttachment as reviewUpstreamAttachment, type MailAttachment } from '../../../../.eliza/client-features/plugins/plugin-files/src/browser/attachment.ts';
export * from '../../../../.eliza/client-features/plugins/plugin-files/src/browser/attachment.ts';

/** A file this app's own checks refused: its bytes do not match the declared type, it is larger than
 * allowed, or its name or encoding is unsafe. It is a decision about the file, not a provider or
 * network failure, so it is never reported as Gmail being unavailable and retrying cannot change it. */
export class AttachmentRefusedError extends Error {
  constructor(message = 'Attachment refused') { super(message); this.name = 'AttachmentRefusedError'; }
}
/** Duck-typed so a refusal from another module instance (tests, sandboxes) is recognised the same way. */
export const attachmentRefused = (error: unknown): boolean => error instanceof AttachmentRefusedError || (!!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AttachmentRefusedError');

/** The upstream review, with its rejection typed. The message is unchanged. */
export async function reviewMailAttachment(file: MailAttachment) {
  try { return await reviewUpstreamAttachment(file); }
  catch (error) { throw attachmentRefused(error) ? error : new AttachmentRefusedError(error instanceof Error ? error.message : undefined); }
}
