#!/usr/bin/env node
/**
 * Hosted half of on-device speech requalification (.github/workflows/android-emulator.yml,
 * job `local-speech`). The decisions stay in scripts/local-speech/requalify-runtime.py; this
 * only checks its candidate before the run and packages what its `ingest` reads afterwards.
 *
 *   node scripts/ci/speech-candidate.mjs check <candidate.json>
 *   node scripts/ci/speech-candidate.mjs package <workspace> <new-output-directory>
 *
 * `check` refuses a candidate that was recorded against another canonical test, another
 * upstream pin, or that has no x86_64 rebuild still waiting to run.
 * `package` copies the candidate (with whatever `requalify-runtime.py run` recorded for
 * x86_64), the raw `am instrument -r` log, the pulled evidence folder and the exact APK pair
 * into one folder, with the candidate as it was before the run, `result.json`, and the `ingest`
 * command that reproduces the record from that earlier candidate.
 * A run that failed or never started is packaged as that: nothing is filled in.
 *
 * An x86_64 pass here is one ABI of one candidate. `admit` still needs every rebuilt ABI
 * passed on its own ABI and a reviewer named by a person.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_TEST = "android/app/src/androidTest/java/ai/elizaresearch/alphaphone/LocalSpeechInstrumentedTest.java";
export const ABI = "x86_64";
const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** Problems that make a candidate unusable for this run; empty when it can run. */
export function candidateProblems(candidate, { canonicalTestSha256, upstreamCommit }) {
  const problems = [];
  if (candidate?.admission !== "requalification-candidate") problems.push("not a requalification candidate");
  if (candidate?.provenance?.canonicalTestSha256 !== canonicalTestSha256) problems.push("the canonical test differs from the one the candidate was recorded against");
  if (candidate?.provenance?.upstreamCommit !== upstreamCommit) problems.push("the candidate was recorded at another upstream pin");
  const rebuilt = (candidate?.qualifiedAbis ?? []).find(abi => abi.abi === ABI);
  if (!rebuilt || !Array.isArray(rebuilt.native) || !rebuilt.native.length) problems.push(`${ABI} is not part of this rebuild`);
  const state = candidate?.functionalAcceptance?.abis?.[ABI]?.state;
  if (state !== "not-executed") problems.push(`${ABI} is already recorded as ${state ?? "missing"}; a hosted run starts from a fresh candidate`);
  if (candidate?.functionalAcceptance?.passed !== false) problems.push("a candidate cannot arrive already passed");
  return problems;
}

/** Copies the ingest inputs into a new folder and says what the candidate records for x86_64. */
export function packageSpeechRun({ workspace, output, repository = process.cwd(), environment = process.env }) {
  const target = path.resolve(repository, output);
  if (fs.existsSync(target)) throw new Error(`${output} already exists; evidence is never replaced`);
  fs.mkdirSync(target, { recursive: true });
  const from = (...parts) => path.resolve(repository, ...parts);
  const missing = [], files = {};
  const copy = (source, name) => {
    if (!fs.existsSync(source)) { missing.push(name); return false; }
    fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true });
    if (fs.statSync(source).isDirectory()) fs.cpSync(source, path.join(target, name), { recursive: true });
    else { fs.copyFileSync(source, path.join(target, name)); files[name] = sha(path.join(target, name)); }
    return true;
  };
  copy(from(workspace, "requalification/candidate.json"), "candidate.json");
  copy(from(workspace, "candidate-before-run.json"), "candidate-before-run.json");
  copy(from(workspace, "requalification", ABI, "instrumentation.log"), `${ABI}/instrumentation.log`);
  if (copy(from(workspace, "requalification", ABI, "local-speech-evidence"), `${ABI}/local-speech-evidence`))
    for (const name of fs.readdirSync(path.join(target, ABI, "local-speech-evidence")).sort()) {
      const file = path.join(target, ABI, "local-speech-evidence", name);
      if (fs.statSync(file).isFile()) files[`${ABI}/local-speech-evidence/${name}`] = sha(file);
    }
  // The same APK pair runs the other ABI of this candidate on an arm64 host.
  copy(from("artifacts/standalone-debug.apk"), "standalone-debug.apk");
  copy(from("artifacts/instrumentation/standalone-androidTest.apk"), "standalone-androidTest.apk");
  const candidate = fs.existsSync(path.join(target, "candidate.json")) ? JSON.parse(fs.readFileSync(path.join(target, "candidate.json"), "utf8")) : null;
  const recorded = candidate?.functionalAcceptance?.abis?.[ABI] ?? null;
  const result = {
    abi: ABI, commit: environment.GITHUB_SHA ?? null, runId: environment.GITHUB_RUN_ID ?? null,
    // Exactly what requalify-runtime.py recorded; `passed` is never inferred here.
    passed: recorded?.passed === true && recorded?.state === "passed" && missing.length === 0,
    state: recorded?.state ?? "no-candidate", recorded, missing, files,
    candidateAarSha256: candidate?.aarSha256 ?? null, upstreamCommit: candidate?.provenance?.upstreamCommit ?? null,
    otherAbis: Object.fromEntries(Object.entries(candidate?.functionalAcceptance?.abis ?? {}).filter(([abi]) => abi !== ABI).map(([abi, value]) => [abi, value.state])),
    admission: "not admitted: every rebuilt ABI must pass on its own ABI and `requalify-runtime.py admit --reviewer` needs a reviewer named by a person",
    // From the repository root at this commit, with DIR the downloaded artifact folder.
    ingest: `cp DIR/candidate-before-run.json DIR/candidate-ingest.json && python3 scripts/local-speech/requalify-runtime.py ingest --abi ${ABI} --device-abi ${ABI} --apk DIR/standalone-debug.apk --log DIR/${ABI}/instrumentation.log --evidence DIR/${ABI}/local-speech-evidence --candidate DIR/candidate-ingest.json`,
    otherAbi: "python3 scripts/local-speech/requalify-runtime.py run --serial <arm64 emulator or device, networking off> --apk DIR/standalone-debug.apk --test-apk DIR/standalone-androidTest.apk --candidate DIR/candidate.json",
    notEvidenceFor: ["speech runtime admission", "arm64-v8a", "microphone, speaker or perceptual quality", "physical-device acceptance"],
  };
  fs.writeFileSync(path.join(target, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, first, second] = process.argv.slice(2);
  if (command === "check" && first && !second) {
    const problems = candidateProblems(JSON.parse(fs.readFileSync(first, "utf8")), {
      canonicalTestSha256: sha(CANONICAL_TEST), upstreamCommit: JSON.parse(fs.readFileSync("upstream.lock.json", "utf8")).commit });
    if (problems.length) { console.error(`Speech candidate refused:\n  - ${problems.join("\n  - ")}`); process.exit(1); }
    console.log(`Speech candidate admitted for the ${ABI} run`);
  } else if (command === "package" && first && second) {
    const result = packageSpeechRun({ workspace: first, output: second });
    console.log(JSON.stringify({ abi: result.abi, passed: result.passed, state: result.state, missing: result.missing }, null, 2));
  } else {
    console.error("Use: node scripts/ci/speech-candidate.mjs check <candidate.json> | package <workspace> <new-output-directory>");
    process.exit(2);
  }
}
