#!/usr/bin/env node
/**
 * Hosted half of on-device speech qualification (.github/workflows/android-emulator.yml, job
 * `fused-speech`). The engine is the fused libelizainference (ASR, Kokoro TTS, Silero VAD) recorded
 * in android/voice-host/qualified-voice-host.json; this script checks the APK before the run and
 * packages what the run produced afterwards.
 *
 *   node scripts/ci/speech-candidate.mjs check <app.apk>
 *   node scripts/ci/speech-candidate.mjs package <results-directory> <new-output-directory>
 *
 * `check` refuses an APK whose voice bundle (assets/voice/v1) or x86_64 engine is not the exact
 * qualified bytes, or that carries no voice bundle at all (the emulator would only prove that
 * local speech is unavailable). `package` copies the instrumentation record, the raw class logs and
 * the exact APK pair into one folder and writes result.json. Nothing is inferred: a run that
 * failed or never started is packaged as that.
 *
 * An x86_64 pass here is one ABI on an emulator (evidence class E). Admission still needs the
 * arm64-v8a engine on hardware (class D) and a reviewer named by a person; the result never edits
 * qualified-voice-host.json.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FUSED_SPEECH_CLASSES } from "./emulator-suite.mjs";

export const CANONICAL_TEST = "android/app/src/androidTest/java/ai/elizaresearch/alphaphone/FusedSpeechInstrumentedTest.java";
export const ABI = "x86_64";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

/** Problems that make an APK unusable for the hosted run; empty when it can run. `read(entry)` returns bytes or null. */
export function candidateProblems({ names, read }, host) {
  const problems = [];
  const manifestBytes = read("assets/voice/v1/manifest.json");
  if (!manifestBytes) return ["the APK carries no on-device voice bundle (assets/voice/v1)"];
  let bundle;
  try { bundle = JSON.parse(manifestBytes.toString("utf8")); } catch { return ["assets/voice/v1/manifest.json is not JSON"]; }
  const pinned = new Map([...host.models.filter(row => row.sha256 !== null), ...(host.lexicon.sha256 !== null ? [host.lexicon] : [])].map(row => [row.path, row]));
  for (const row of bundle.files ?? []) {
    const expected = pinned.get(row.path), bytes = read(`assets/voice/v1/${row.path}`);
    if (!expected || !bytes || bytes.length !== expected.bytes || sha(bytes) !== expected.sha256) problems.push(`assets/voice/v1/${row.path} is not a qualified voice file`);
  }
  const record = host.abis.find(row => row.abi === ABI);
  if (!record?.voiceSymbolsVerified) problems.push(`${ABI} has no voice-symbol qualification in android/voice-host/qualified-voice-host.json`);
  else for (const library of record.libraries) {
    const bytes = read(`lib/${ABI}/${library.name}`);
    if (!bytes || bytes.length !== library.bytes || sha(bytes) !== library.sha256) problems.push(`lib/${ABI}/${library.name} differs from the voice-qualified bytes`);
  }
  if (!names.some(name => name === `lib/${ABI}/libelizavoicejni.so`)) problems.push(`lib/${ABI}/libelizavoicejni.so is not packaged`);
  if (!(bundle.files ?? []).some(row => row.role === "asr-model")) problems.push("no ASR pair is packaged; FusedSpeech transcription cannot run (no product-qualified mobile ASR pair exists upstream)");
  return problems;
}

function apkReader(file) {
  const names = execFileSync("unzip", ["-Z1", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  return { names, read: entry => names.includes(entry) ? execFileSync("unzip", ["-p", file, entry], { maxBuffer: 512 * 1024 * 1024 }) : null };
}

/** Copies the run's record and APK pair into a new folder and says what the record shows. */
export function packageSpeechRun({ results, output, repository = process.cwd(), environment = process.env }) {
  const target = path.resolve(repository, output);
  if (fs.existsSync(target)) throw new Error(`${output} already exists; evidence is never replaced`);
  fs.mkdirSync(target, { recursive: true });
  const missing = [], files = {};
  const copy = (source, name) => {
    if (!fs.existsSync(source)) { missing.push(name); return false; }
    if (fs.statSync(source).isDirectory()) {
      fs.cpSync(source, path.join(target, name), { recursive: true });
      // Every copied record file is hashed too, so the package names exactly what it holds.
      for (const entry of fs.readdirSync(path.join(target, name), { recursive: true }).map(String).sort()) {
        const file = path.join(target, name, entry);
        if (fs.statSync(file).isFile()) files[`${name}/${entry.split(path.sep).join("/")}`] = sha(fs.readFileSync(file));
      }
    }
    else { fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true }); fs.copyFileSync(source, path.join(target, name)); files[name] = sha(fs.readFileSync(path.join(target, name))); }
    return true;
  };
  copy(path.resolve(repository, results), "instrumentation");
  copy(path.resolve(repository, "artifacts/standalone-debug.apk"), "standalone-debug.apk");
  copy(path.resolve(repository, "artifacts/instrumentation/standalone-androidTest.apk"), "standalone-androidTest.apk");
  const record = fs.existsSync(path.join(target, "instrumentation/results.json")) ? JSON.parse(fs.readFileSync(path.join(target, "instrumentation/results.json"), "utf8")) : null;
  const classes = (record?.classes ?? []).map(row => ({ class: row.class.split(".").at(-1).replace(/InstrumentedTest$/, ""), status: row.status }));
  const ran = new Set(classes.filter(row => row.status === "passed").map(row => row.class));
  const result = {
    abi: ABI, commit: environment.GITHUB_SHA ?? null, runId: environment.GITHUB_RUN_ID ?? null, evidenceClass: "E",
    canonicalTestSha256: fs.existsSync(path.resolve(repository, CANONICAL_TEST)) ? sha(fs.readFileSync(path.resolve(repository, CANONICAL_TEST))) : null,
    // Exactly what the instrumentation record says; `passed` is never inferred here.
    passed: record?.passed === true && FUSED_SPEECH_CLASSES.every(name => ran.has(name)) && missing.length === 0,
    classes, missing, files,
    admission: "not admitted: arm64-v8a on hardware (class D) and a reviewer named by a person are still required; qualified-voice-host.json evidence is edited only by that review",
    notEvidenceFor: ["arm64-v8a", "microphone, speaker or perceptual quality", "Kokoro intelligibility", "physical-device acceptance"],
  };
  fs.writeFileSync(path.join(target, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, first, second] = process.argv.slice(2);
  if (command === "check" && first && !second) {
    const host = JSON.parse(fs.readFileSync("android/voice-host/qualified-voice-host.json", "utf8"));
    const problems = candidateProblems(apkReader(first), host);
    if (problems.length) { console.error(`Speech candidate refused:\n  - ${problems.join("\n  - ")}`); process.exit(1); }
    console.log(`Speech candidate admitted for the ${ABI} emulator run`);
  } else if (command === "package" && first && second) {
    const result = packageSpeechRun({ results: first, output: second });
    console.log(JSON.stringify({ abi: result.abi, passed: result.passed, classes: result.classes, missing: result.missing }, null, 2));
  } else {
    console.error("Use: node scripts/ci/speech-candidate.mjs check <app.apk> | package <results-directory> <new-output-directory>");
    process.exit(2);
  }
}
