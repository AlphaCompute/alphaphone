import { useEffect, useRef, useState } from "react";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type Clip = { recordingId: string; durationMs: number };
const Voice = registerPlugin<{
  startRecording(): Promise<{ recordingId: string; maxDurationMs: number }>;
  stopRecording(): Promise<Clip>;
  transcribeRecording(input: {
    recordingId: string;
    requestId: string;
  }): Promise<{ text: string; local: boolean }>;
  cancelRecording(): Promise<unknown>;
  cancel(input: { requestId: string }): Promise<unknown>;
  addListener(
    event: "recordingStopped",
    handler: (clip: Clip) => void,
  ): Promise<PluginListenerHandle>;
}>("DevelopmentAgent");

/** Emulator-only capture. Each stage requires a separate visible user action. */
export function VoiceRecorder({
  onClose,
  onTranscript,
}: {
  onClose: () => void;
  onTranscript: (text: string) => void;
}) {
  const [stage, setStage] = useState<
    "ready" | "starting" | "recording" | "recorded" | "transcribing"
  >("ready");
  const [clip, setClip] = useState<Clip | null>(null);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const request = useRef<string | null>(null);
  const alive = useRef(true);
  const panel = useRef<HTMLElement>(null);
  const operation = useRef(false);
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = Voice.addListener("recordingStopped", (value) => {
      if (!alive.current) return;
      if (!value.recordingId || !Number.isFinite(value.durationMs)) {
        setClip(null);
        setStage("ready");
        setError(
          "Recording stopped without a usable audio clip. Try recording again.",
        );
        return;
      }
      setClip(value);
      setStage("recorded");
    });
    return () => {
      alive.current = false;
      void listener.then((l) => l.remove());
      if (request.current)
        void Voice.cancel({ requestId: request.current }).catch(() => {});
      void Voice.cancelRecording().catch(() => {});
      previous?.focus();
    };
  }, []);
  async function act(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setError("");
    try {
      await action();
    } catch {
      if (alive.current) {
        setError(
          "Voice could not complete. Check microphone permission and the local development service, then try again.",
        );
        setStage(clip ? "recorded" : "ready");
      }
    } finally {
      operation.current = false;
    }
  }
  return (
    <div className="dialog-backdrop">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-title"
        className="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const buttons = Array.from(
              panel.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ) || [],
            );
            if (event.shiftKey && document.activeElement === buttons[0]) {
              event.preventDefault();
              buttons.at(-1)?.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement === buttons.at(-1)
            ) {
              event.preventDefault();
              buttons[0]?.focus();
            }
          }
        }}
      >
        <h2 id="voice-title">Voice draft</h2>
        <p>
          Development mode: record up to one minute. After you stop, choose
          Transcribe to process audio on this computer. Review the text before
          adding it to your draft.
        </p>
        <p role="status">
          {stage === "recording"
            ? "Recording… Stop when finished."
            : stage === "starting"
              ? "Starting microphone…"
              : stage === "transcribing"
                ? "Transcribing locally…"
                : clip
                  ? `${Math.round(clip.durationMs / 1000)} seconds recorded.`
                  : "Microphone is off."}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {transcript !== null ? (
          <label>
            Review transcript
            <textarea
              aria-label="Review transcript"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
            />
          </label>
        ) : null}
        <div className="actions">
          {stage === "ready" ? (
            <button
              onClick={() =>
                void act(async () => {
                  setStage("starting");
                  await Voice.startRecording();
                  if (alive.current) setStage("recording");
                })
              }
            >
              Start recording
            </button>
          ) : null}
          {stage === "recording" ? (
            <button
              onClick={() =>
                void act(async () => {
                  const value = await Voice.stopRecording();
                  if (alive.current) {
                    setClip(value);
                    setStage("recorded");
                  }
                })
              }
            >
              Stop recording
            </button>
          ) : null}
          {stage === "recorded" && clip && transcript === null ? (
            <button
              onClick={() =>
                void act(async () => {
                  setStage("transcribing");
                  request.current = crypto.randomUUID();
                  const result = await Voice.transcribeRecording({
                    recordingId: clip.recordingId,
                    requestId: request.current,
                  });
                  request.current = null;
                  if (typeof result.text !== "string" || result.local !== true)
                    throw new Error("Invalid transcription");
                  if (alive.current) {
                    setTranscript(result.text);
                    setStage("recorded");
                  }
                })
              }
            >
              Transcribe locally
            </button>
          ) : null}
          {stage === "recorded" ? (
            <button
              onClick={() =>
                void act(async () => {
                  await Voice.cancelRecording();
                  if (alive.current) {
                    setClip(null);
                    setTranscript(null);
                    setStage("ready");
                  }
                })
              }
            >
              Record again
            </button>
          ) : null}
          {transcript !== null ? (
            <button
              disabled={!transcript.trim()}
              onClick={() => {
                onTranscript(transcript.trim());
                onClose();
              }}
            >
              Add to draft
            </button>
          ) : null}
          <button onClick={onClose}>Cancel voice</button>
        </div>
      </section>
    </div>
  );
}
