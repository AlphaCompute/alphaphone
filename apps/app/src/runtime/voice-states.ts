/** Pure recorder state helpers: failure classification, progress text and transcript provenance. */
export type VoiceFailure = 'denied' | 'no-microphone' | 'no-speech' | 'model' | 'recognition';
export type TranscriptProvenance = { route: string; engine?: string; model?: string; modelRevision?: string; runtime?: string; language?: string };
type Reason = { name?: unknown; code?: unknown } | null | undefined;

/**
 * Failures with their own state and guidance. Anything else keeps the caller's generic,
 * route-specific message. Cancellation is never reported as a failure here.
 */
export function voiceFailure(reason: unknown, context: { transcribing: boolean; browser: boolean }): { kind: VoiceFailure; message: string } | null {
  const value = (reason && typeof reason === 'object' ? reason : undefined) as Reason;
  const name = typeof value?.name === 'string' ? value.name : '', code = typeof value?.code === 'string' ? value.code : '';
  if (name === 'AbortError') return null;
  // Android's AlphaVoiceCloud rejects a refused RECORD_AUDIO request with code 'permission-denied'.
  if (!context.transcribing && (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError' || code === 'permission-denied'))
    return { kind: 'denied', message: context.browser
      ? 'Microphone access is blocked. Allow the microphone for this site in your browser’s site settings, then choose Start recording again, or use the keyboard instead. Nothing was recorded.'
      : 'Microphone access is off. Choose Open app settings and allow the microphone for Alpha in Android settings, then choose Start recording again, or use the keyboard instead. Nothing was recorded.' };
  if (!context.transcribing && (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError'))
    return { kind: 'no-microphone', message: 'No usable microphone was found. Connect or enable a microphone, then choose Start recording again.' };
  if (code === 'no-speech')
    return { kind: 'no-speech', message: 'No speech was detected in this recording. Record again, or type the transcript instead.' };
  if (code === 'model-load-failed')
    return { kind: 'model', message: 'The speech model could not be loaded. Check your connection to this app and choose Transcribe again, or type the transcript instead. Your recording is kept.' };
  if (code === 'recognition-failed')
    return { kind: 'recognition', message: 'Speech recognition failed for this recording. Choose Transcribe again, or type the transcript instead. Your recording is kept.' };
  return null;
}

const megabytes = (bytes: number) => Math.max(0, Math.round(bytes / 1_000_000));
/** Status text for the in-browser recognizer: model download, model start-up, recognition. */
export function speechProgressMessage(progress?: { phase: string; loaded?: number; total?: number }) {
  if (progress?.phase === 'download' && Number.isFinite(progress.loaded) && Number.isFinite(progress.total) && progress.total! > 0)
    return `Loading the speech model from this app: ${megabytes(progress.loaded!)} of ${megabytes(progress.total!)} MB. Nothing is uploaded.`;
  if (progress?.phase === 'download') return 'Loading the speech model from this app. Nothing is uploaded.';
  if (progress?.phase === 'initialize') return 'Starting the speech model in this browser. Nothing is uploaded.';
  return 'Transcribing in this browser. Nothing has been saved or uploaded.';
}

const field = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : undefined;
/** Where a transcript came from. Only fields reported by the engine are recorded, never guessed. */
export function transcriptProvenance(result: Record<string, unknown>, route: { onDevice: boolean; native: boolean; paired: boolean; cloud: boolean }): TranscriptProvenance {
  const reported = field(result.route);
  const name = route.cloud ? 'eliza-cloud' : route.paired ? 'paired-agent' : route.onDevice ? (route.native ? 'on-device' : reported || 'browser') : 'development-agent';
  const provenance: TranscriptProvenance = { route: name };
  for (const key of ['engine', 'model', 'modelRevision', 'runtime', 'language'] as const) { const value = field(result[key]); if (value) provenance[key] = value; }
  return provenance;
}
