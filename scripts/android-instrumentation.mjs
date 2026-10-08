#!/usr/bin/env node
/**
 * Install both distribution variants with their instrumentation APKs on an owned,
 * disposable emulator and run a named class list or the whole androidTest suite.
 *
 *   npm run test:android:instrumentation -- --owned-emulator --avd <name> \
 *     [--serial emulator-5554] [--classes NoMockProduct,Shell,StartupReadiness | --all] \
 *     [--variants standalone,launcher] [--test-mocks] [--apk-dir artifacts] \
 *     [--output test-results/android-instrumentation/<run>] [--timeout-ms 900000] \
 *     [--clock-exclusive]
 *
 * Variants share one package id and replace each other, so they run one after the
 * other: install app + test APK, check the installed bytes, run every class in its
 * own `am instrument` process, uninstall. Only packages this run installed are
 * removed; an existing Alpha installation is refused, never replaced.
 *
 * Results: <output>/results.json via scripts/instrumentation-result.mjs, bound to
 * the source commit and every installed APK's SHA-256, with raw output per class.
 * This is emulator-class evidence (class E). It is not physical-device, AOSP image,
 * real-integration or user acceptance.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { instrumentationClassResults, listedInstrumentationTests, writeInstrumentationRecord } from "./instrumentation-result.mjs";

export const PACKAGE = "ai.elizaresearch.alphaphone";
const RUNNER = "androidx.test.runner.AndroidJUnitRunner";

/**
 * Known classes and how to run them. `args` are the class's explicit opt-in gates.
 * `phases` run methods in order, each in a new instrumentation process.
 * `campaign` classes need orchestration this runner does not perform (process
 * kills mid-test, permission restoration, provider credential fixtures); they are
 * refused here and named with the campaign that runs them.
 */
export const CLASS_REGISTRY = {
  NoMockProduct: {},
  Shell: {},
  StartupReadiness: { args: { startupReadiness: "1" } },
  TextScale: { note: "textScaleProcessRestartPhase is skipped here; run node scripts/test-native-restart.mjs text-scale" },
  BrowserSignins: {},
  BrowserFlow: { note: "loopback fixture methods need --test-mocks" },
  BrowserContinuity: { note: "bookmarkProcessRestartPhase is skipped here; run node scripts/test-native-restart.mjs bookmark" },
  BrowserDownload: { note: "needs --test-mocks (loopback HTTP fixtures)" },
  PasswordAutofillOffer: { testMocks: true },
  HostedProcessRestart: {
    args: { alphaHostedProcessRestartFixture: "true" },
    phases: ["prepareCommittedResultWithLostAck", "resumeAfterProcessDeathRecoversAckOnce", "verifySecondRestartAndCleanup"],
  },
  RealClock: { args: { realClock: "1", clockExclusive: "1" }, requires: "--clock-exclusive" },
  Accessibility: {},
  Rotation: {},
  ResidentEgressRedaction: { campaign: "ALPHA_RESIDENT_DISPOSABLE_EMULATOR=1 node scripts/android-resident-instrumentation.mjs <app.apk> <androidTest.apk> (owner-only provider key fixture, ARM64)" },
  ReminderTapProcessDeath: { campaign: "python3 scripts/ci/pending-recovery-ui.py (external process death)" },
  WorkflowNoticeProcessDeath: { campaign: "python3 scripts/ci/pending-recovery-ui.py (external process death)" },
  NotificationChannels: { campaign: "node scripts/test-native-permissions.mjs channels APP.apk TEST.apk OUTPUT (permission-restoring runner)" },
};

export const DEFAULT_CLASSES = [
  "NoMockProduct", "Shell", "StartupReadiness", "TextScale", "BrowserSignins", "BrowserFlow",
  "BrowserContinuity", "HostedProcessRestart", "BrowserDownload",
];

const short = name => name.replace(new RegExp(`^${PACKAGE.replace(/\./g, "\\.")}\\.`), "").replace(/InstrumentedTest$/, "");
export const qualifiedClass = name => {
  if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(name)) throw new Error(`Invalid class ${JSON.stringify(name)}`);
  if (name.includes(".")) return name;
  return `${PACKAGE}.${name.endsWith("InstrumentedTest") ? name : `${name}InstrumentedTest`}`;
};

export function parseInstrumentationArgs(argv) {
  const options = { classes: null, all: false, variants: ["standalone", "launcher"], testMocks: false, apkDir: null, output: null,
    serial: null, avd: null, ownedEmulator: false, timeoutMs: 900_000, clockExclusive: false };
  const value = (arg, index) => {
    if (arg.includes("=")) return [arg.slice(arg.indexOf("=") + 1), index];
    if (argv[index + 1] === undefined) throw new Error(`${arg} needs a value`);
    return [argv[index + 1], index + 1];
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const name = arg.split("=")[0];
    let v;
    switch (name) {
      case "--all": options.all = true; break;
      case "--test-mocks": options.testMocks = true; break;
      case "--owned-emulator": options.ownedEmulator = true; break;
      case "--clock-exclusive": options.clockExclusive = true; break;
      case "--classes": [v, index] = value(arg, index); options.classes = v.split(",").map(s => s.trim()).filter(Boolean); break;
      case "--variants": [v, index] = value(arg, index); options.variants = v.split(",").map(s => s.trim()).filter(Boolean); break;
      case "--apk-dir": [v, index] = value(arg, index); options.apkDir = v; break;
      case "--output": [v, index] = value(arg, index); options.output = v; break;
      case "--serial": [v, index] = value(arg, index); options.serial = v; break;
      case "--avd": [v, index] = value(arg, index); options.avd = v; break;
      case "--timeout-ms": [v, index] = value(arg, index); options.timeoutMs = Number(v); break;
      default: throw new Error(`Unknown option ${arg}`);
    }
  }
  if (options.all && options.classes) throw new Error("Choose --classes or --all, not both");
  if (!options.variants.length || options.variants.some(v => !["standalone", "launcher"].includes(v)) || new Set(options.variants).size !== options.variants.length)
    throw new Error("--variants must list standalone and/or launcher once each");
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 10_000) throw new Error("--timeout-ms must be at least 10000");
  options.apkDir ??= options.testMocks ? "artifacts/test-mocks" : "artifacts";
  if (!options.all) {
    const requested = (options.classes ?? DEFAULT_CLASSES).map(qualifiedClass);
    if (new Set(requested).size !== requested.length) throw new Error("Duplicate class");
    for (const cls of requested) {
      const spec = CLASS_REGISTRY[short(cls)] ?? {};
      if (spec.campaign) throw new Error(`${short(cls)} needs its own campaign: ${spec.campaign}`);
      if (spec.requires === "--clock-exclusive" && !options.clockExclusive)
        throw new Error(`${short(cls)} changes real alarms; pass --clock-exclusive only on an exclusive, unlocked emulator with no other timers`);
      if (spec.testMocks && !options.testMocks) throw new Error(`${short(cls)} runs only on the --test-mocks variant`);
    }
    options.classes = requested;
  }
  return options;
}

/** `am instrument` arguments for one class (or one phase method), never through a shell. */
export function instrumentArgs(cls, { method, log = false } = {}) {
  const spec = CLASS_REGISTRY[short(cls)] ?? {};
  const extras = Object.entries(spec.args ?? {}).flatMap(([key, val]) => ["-e", key, val]);
  return ["shell", "am", "instrument", "-w", "-r", ...(log ? ["-e", "log", "true"] : []), ...extras,
    "-e", "class", method ? `${cls}#${method}` : cls, `${PACKAGE}.test/${RUNNER}`];
}

/** Locate a variant's app/test APK pair and bind the app to the verify-apks manifest. */
export function admitApks(apkDir, variant, { testMocks }) {
  const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const manifestFile = path.join(apkDir, "apk-manifest.json");
  if (!fs.existsSync(manifestFile)) throw new Error(`${manifestFile} is missing; build and verify the APKs first`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.testMocks !== testMocks) throw new Error(`${manifestFile} records testMocks=${manifest.testMocks}; expected ${testMocks}`);
  const app = path.join(apkDir, `${variant}-debug.apk`);
  const test = testMocks ? path.join(apkDir, `${variant}-androidTest.apk`) : path.join(apkDir, "instrumentation", `${variant}-androidTest.apk`);
  for (const file of [app, test]) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  const appSha256 = sha(app), testSha256 = sha(test);
  const row = manifest.results?.find(entry => entry.variant === variant && entry.mode === "debug");
  if (!row || row.sha256 !== appSha256) throw new Error(`${app} does not match the verified ${manifestFile} row`);
  const recordedTest = manifest.instrumentation?.[variant]?.sha256;
  if (recordedTest !== undefined && recordedTest !== testSha256) throw new Error(`${test} does not match ${manifestFile}`);
  return [
    { variant, role: "app", file: app, sha256: appSha256, versionCode: row.versionCode, testMocks },
    { variant, role: "test", file: test, sha256: testSha256, testMocks },
  ];
}

function sourceCommit() {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() !== "";
  return { commit, dirty };
}

async function main() {
  const options = parseInstrumentationArgs(process.argv.slice(2));
  const serial = options.serial ?? process.env.ANDROID_SERIAL;
  if (!options.ownedEmulator) throw new Error("Pass --owned-emulator to confirm the emulator is disposable and owned by this run");
  if (!/^emulator-\d+$/.test(serial ?? "")) throw new Error("An emulator serial (emulator-NNNN) is required; physical devices are refused");
  if (!/^[A-Za-z0-9_.-]+$/.test(options.avd ?? "")) throw new Error("--avd <name> of the owned emulator is required");
  const { androidEnv } = await import("./toolchain.mjs");
  const env = androidEnv();
  const adbPath = path.join(env.ANDROID_HOME, "platform-tools/adb");
  const adb = (args, { timeout = 120_000, allowFailure = false } = {}) => {
    const result = spawnSync(adbPath, ["-s", serial, ...args], { encoding: "utf8", env, timeout, maxBuffer: 64 << 20 });
    if (!allowFailure && (result.error || result.status !== 0))
      throw new Error(`adb ${args.slice(0, 3).join(" ")} failed: ${result.error?.message ?? result.stderr}`);
    return `${result.stdout ?? ""}${allowFailure ? result.stderr ?? "" : ""}`;
  };

  // Admission before any installation.
  const avd = adb(["emu", "avd", "name"]).split(/\r?\n/)[0].trim();
  if (avd !== options.avd) throw new Error(`Serial ${serial} runs AVD ${JSON.stringify(avd)}, not ${options.avd}`);
  const prop = name => adb(["shell", "getprop", name]).trim();
  if (prop("ro.kernel.qemu") !== "1" && prop("ro.boot.qemu") !== "1") throw new Error("Not an emulator");
  if (prop("sys.boot_completed") !== "1") throw new Error("Emulator has not finished booting");
  const packages = adb(["shell", "pm", "list", "packages", "-u", "--user", "all"]).split(/\r?\n/).map(s => s.trim());
  if (packages.some(row => row === `package:${PACKAGE}` || row === `package:${PACKAGE}.test`))
    throw new Error("Alpha Phone or its test package is already installed; use a fresh emulator (never replaced)");
  const apks = options.variants.flatMap(variant => admitApks(options.apkDir, variant, options));
  const { commit, dirty } = sourceCommit();
  const runId = randomUUID();
  const output = path.resolve(options.output ?? path.join("test-results/android-instrumentation", `${new Date().toISOString().replace(/[:.]/g, "-")}-${runId.slice(0, 8)}`));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(output); // Fresh directory: never mix with older evidence.

  const { acquireDeviceLease, deviceLeaseStateDir } = await import("../vendor/eliza/packages/app/scripts/lib/device-lease.ts");
  const lease = await acquireDeviceLease(`android:${serial}`, { waitMs: 0, ttlMs: Number.MAX_SAFE_INTEGER, stateDir: deviceLeaseStateDir(process.env) });
  const classes = [];
  const installed = [];
  const emulator = { avd, abi: prop("ro.product.cpu.abi"), sdk: prop("ro.build.version.sdk"), serialSha256: createHash("sha256").update(serial).digest("hex") };
  const fingerprint = (pkg, expected) => {
    const apkPath = /^package:(\/\S+\.apk)$/m.exec(adb(["shell", "pm", "path", pkg]))?.[1];
    const actual = apkPath && adb(["shell", "sha256sum", apkPath]).trim().split(/\s+/)[0];
    if (actual !== expected) throw new Error(`Installed ${pkg} bytes do not match the admitted APK`);
  };
  try {
    for (const variant of options.variants) {
      const [app, test] = apks.filter(apk => apk.variant === variant);
      adb(["install", "-t", app.file], { timeout: 600_000 }); installed.push(PACKAGE);
      adb(["install", "-t", test.file], { timeout: 600_000 }); installed.push(`${PACKAGE}.test`);
      fingerprint(PACKAGE, app.sha256);
      fingerprint(`${PACKAGE}.test`, test.sha256);
      const dir = path.join(output, variant);
      fs.mkdirSync(dir);
      const record = (cls, parsed, extra = {}) => classes.push({ variant, ...parsed, class: cls, ...extra });
      if (options.all) {
        const raw = adb(["shell", "am", "instrument", "-w", "-r", `${PACKAGE}.test/${RUNNER}`], { timeout: options.timeoutMs * 20, allowFailure: true });
        fs.writeFileSync(path.join(dir, "all.txt"), raw);
        for (const row of instrumentationClassResults(raw).results) record(row.class, row);
      } else {
        for (const cls of options.classes) {
          const spec = CLASS_REGISTRY[short(cls)] ?? {};
          const listed = listedInstrumentationTests(adb(instrumentArgs(cls, { log: true }), { allowFailure: true }));
          if (!listed.length) { record(cls, { started: 0, passed: 0, failed: [], ignored: [], status: "missing" }); continue; }
          const runs = spec.phases ? spec.phases : [null];
          let merged = { started: 0, passed: 0, failed: [], ignored: [], status: "passed" };
          for (const method of runs) {
            const raw = adb(instrumentArgs(cls, { method }), { timeout: options.timeoutMs, allowFailure: true });
            fs.writeFileSync(path.join(dir, `${short(cls)}${method ? `-${method}` : ""}.txt`), raw);
            const row = instrumentationClassResults(raw, [cls]).results.find(entry => entry.class === cls);
            merged = { started: merged.started + row.started, passed: merged.passed + row.passed,
              failed: [...merged.failed, ...row.failed], ignored: [...merged.ignored, ...row.ignored],
              // A phase that did not run (missing) or only skipped fails the phased class.
              status: merged.status !== "passed" ? merged.status : row.status === "passed" ? "passed" : "failed" };
            if (row.status !== "passed") break; // Later phases depend on earlier ones.
          }
          record(cls, merged, { listed: listed.length, ...(spec.note ? { note: spec.note } : {}) });
        }
      }
      adb(["uninstall", `${PACKAGE}.test`], { allowFailure: true }); installed.splice(installed.indexOf(`${PACKAGE}.test`), 1);
      adb(["uninstall", PACKAGE], { allowFailure: true }); installed.splice(installed.indexOf(PACKAGE), 1);
    }
  } finally {
    // Remove only what this run installed.
    for (const pkg of [...new Set(installed)].reverse()) adb(["uninstall", pkg], { allowFailure: true });
    lease.release();
  }
  const result = writeInstrumentationRecord(path.join(output, "results.json"), {
    runId, createdAt: new Date().toISOString(), commit, dirty, testMocks: options.testMocks, emulator,
    apks: apks.map(({ file, ...apk }) => ({ ...apk, file: path.relative(process.cwd(), path.resolve(file)) })),
    mode: options.all ? "all" : "classes",
    classes,
  });
  for (const row of classes) console.log(`${row.status.padEnd(8)} ${row.variant.padEnd(10)} ${short(row.class)}${row.ignored.length ? ` (skipped by assumption: ${row.ignored.join(", ")})` : ""}`);
  console.log(`${result.passed ? "PASSED" : "FAILED"}: ${path.relative(process.cwd(), path.join(output, "results.json"))} (emulator class E evidence only; not device acceptance)`);
  process.exitCode = result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
