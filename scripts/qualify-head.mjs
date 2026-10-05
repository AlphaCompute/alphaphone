/**
 * Qualify the current checkout HEAD from scratch and record one result file.
 *
 *   node scripts/qualify-head.mjs [--allow-unpackaged-runtime] [--fresh]
 *                                 [--engines chromium,firefox,webkit] [--skip-android]
 *
 * Writes test-results/qualify/<sha>/result.json with the git SHA, the
 * upstream.lock.json commit, `npm run verify`, `npm run android:build` (standalone
 * and launcher, debug and release), the production bundle audit, and per-engine
 * results for the browser storage-domain specs. Every step runs now; no earlier
 * log, manifest or result is reused (--fresh deletes an older directory for the
 * same SHA, otherwise the script refuses to overwrite it). A dirty tree is
 * recorded and can never qualify.
 *
 * Evidence scope: source tests, browser engines on a development server and APK
 * builds. It is not an emulator, AOSP image, real-integration or device result.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkRequiredPlaywrightResults } from "../vendor/eliza/packages/scripts/check-required-playwright-results.ts";

import { STORAGE_SPECS } from "./storage-specs.mjs";
export { STORAGE_SPECS };
export const ENGINES = Object.freeze(["chromium", "firefox", "webkit"]);

export function parseQualifyArgs(argv) {
  const options = { allowUnpackagedRuntime: false, fresh: false, skipAndroid: false, engines: [...ENGINES] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--allow-unpackaged-runtime") options.allowUnpackagedRuntime = true;
    else if (arg === "--fresh") options.fresh = true;
    else if (arg === "--skip-android") options.skipAndroid = true;
    else if (arg === "--engines") {
      const value = argv[++i];
      const engines = (value ?? "").split(",").filter(Boolean);
      if (!engines.length || engines.some(engine => !ENGINES.includes(engine)))
        throw new Error(`--engines takes a comma list of ${ENGINES.join(", ")}`);
      options.engines = engines;
    } else throw new Error(`Unknown option ${arg}`);
  }
  return options;
}

/** Admit complete terminal evidence using the shared upstream report validator. */
export function qualifyPlaywrightReport(report) {
  const counts = checkRequiredPlaywrightResults(report,
    STORAGE_SPECS.map(file => path.relative("test/browser", file)));
  return { ...counts, failures: [] };
}

/** Overall verdict: every step ran now and passed on a clean, pinned tree, on all engines. */
export function verdict(result) {
  const passed = step => step?.status === "passed";
  const browserPassed = step => passed(step) && Number.isSafeInteger(step.expected) && step.expected > 0
    && step.unexpected === 0 && step.flaky === 0 && step.skipped === 0
    && Array.isArray(step.failures) && step.failures.length === 0;
  return Boolean(result.clean && result.upstream?.matches
    && passed(result.verify) && passed(result.androidBuild) && passed(result.bundleAudit)
    && ENGINES.every(engine => browserPassed(result.storageSpecs?.[engine])));
}

function git(args) {
  const out = spawnSync("git", args, { encoding: "utf8" });
  if (out.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr}`);
  return out.stdout.trim();
}

function main() {
  const options = parseQualifyArgs(process.argv.slice(2));
  const root = path.resolve(import.meta.dirname, "..");
  process.chdir(root);
  const sha = git(["rev-parse", "HEAD"]);
  // Untracked (non-ignored) files can change what builds, so they make the tree dirty too.
  const status = git(["status", "--porcelain", "--untracked-files=normal"]);
  const lock = JSON.parse(fs.readFileSync("upstream.lock.json", "utf8"));
  const vendorHead = git(["-C", "vendor/eliza", "rev-parse", "HEAD"]);
  const directory = path.join("test-results/qualify", sha);
  if (fs.existsSync(directory)) {
    if (!options.fresh) throw new Error(`${directory} already exists; rerun with --fresh to replace it (older results are never reused)`);
    fs.rmSync(directory, { recursive: true, force: true });
  }
  fs.mkdirSync(directory, { recursive: true });
  const result = {
    schemaVersion: 1,
    sha,
    clean: status === "",
    dirtyFiles: status ? status.split("\n").map(line => line.slice(3)) : [],
    upstream: { lockCommit: lock.commit, vendorHead, matches: lock.commit === vendorHead },
    startedAt: new Date().toISOString(),
    evidenceScope: "source tests, browser engines against a development server and APK builds only; not emulator, AOSP image, real integration or device acceptance",
  };
  const write = () => fs.writeFileSync(path.join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n");
  write();

  // Distribution steps always run flag-off; browser specs enable the flag
  // explicitly through the Playwright web server.
  const flagOff = { ...process.env };
  for (const name of ["ELIZA_DEV_ALLOW_TEST_MOCKS", "VITE_ELIZA_DEV_ALLOW_TEST_MOCKS", "ORG_GRADLE_PROJECT_ELIZA_DEV_ALLOW_TEST_MOCKS"]) delete flagOff[name];
  const step = (name, command, args, env = flagOff, timeout = 3600000) => {
    const started = Date.now();
    const log = path.join(directory, `${name}.log`);
    const out = spawnSync(command, args, { env, encoding: "utf8", timeout, maxBuffer: 256 * 1024 * 1024 });
    fs.writeFileSync(log, `$ ${command} ${args.join(" ")}\n${out.stdout ?? ""}${out.stderr ?? ""}${out.error ? `\n${out.error.message}` : ""}`);
    const record = { status: out.status === 0 ? "passed" : "failed", exitCode: out.status, signal: out.signal ?? null, durationMs: Date.now() - started, log: path.relative(root, log) };
    console.log(`${name}: ${record.status}`);
    return record;
  };

  if (!result.upstream.matches) {
    result.verify = { status: "failed", reason: "vendor/eliza HEAD differs from upstream.lock.json" };
  } else {
    result.verify = step("verify", "npm", ["run", "verify"]);
  }
  write();

  if (options.skipAndroid) result.androidBuild = { status: "skipped", reason: "--skip-android" };
  else {
    // Remove the previous manifest first so a failed build can never report it.
    fs.rmSync("artifacts/apk-manifest.json", { force: true });
    result.androidBuild = step("android-build", "npm", ["run", "android:build", ...(options.allowUnpackagedRuntime ? ["--", "--allow-unpackaged-runtime"] : [])]);
    if (fs.existsSync("artifacts/apk-manifest.json")) {
      const manifest = JSON.parse(fs.readFileSync("artifacts/apk-manifest.json", "utf8"));
      fs.copyFileSync("artifacts/apk-manifest.json", path.join(directory, "apk-manifest.json"));
      result.androidBuild.testMocks = manifest.testMocks;
      result.androidBuild.demoEntryPoints = manifest.demoEntryPoints;
      result.androidBuild.mapsConfigured = manifest.mapsConfigured;
      result.androidBuild.version = manifest.version;
      result.androidBuild.signing = manifest.signing;
      result.androidBuild.apks = manifest.results.map(row => ({
        variant: row.variant, mode: row.mode, file: row.file, sha256: row.sha256, signed: row.signed,
        runtime: row.runtime, distributable: row.distributable, bundleAudit: row.bundleAudit,
      }));
      const expected = ["standalone/debug", "standalone/release", "launcher/debug", "launcher/release"];
      const built = manifest.results.map(row => `${row.variant}/${row.mode}`).sort();
      if (JSON.stringify(built) !== JSON.stringify([...expected].sort())) {
        result.androidBuild.status = "failed";
        result.androidBuild.reason = `Expected ${expected.join(", ")}`;
      }
    } else if (result.androidBuild.status === "passed") {
      result.androidBuild.status = "failed";
      result.androidBuild.reason = "No APK manifest was produced";
    }
  }
  write();

  // The web bundle in web-dist is from the flag-off build above (android:sync
  // or verify's build). Audit it again here as its own recorded step.
  result.bundleAudit = fs.existsSync("scripts/audit-production-bundle.mjs")
    ? step("bundle-audit", process.execPath, ["scripts/audit-production-bundle.mjs", "web-dist"])
    : { status: "failed", reason: "scripts/audit-production-bundle.mjs is missing" };
  write();

  // playwright.config.ts defines one project per engine; --browser is refused there.
  result.storageSpecs = {};
  for (const engine of options.engines) {
    const report = path.join(directory, `storage-${engine}.json`);
    const record = step(`storage-${engine}`, "npx", ["playwright", "test", ...STORAGE_SPECS, `--project=${engine}`, "--reporter=json"],
      { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report }, 3600000);
    if (fs.existsSync(report)) {
      record.report = path.relative(root, report);
      try { Object.assign(record, qualifyPlaywrightReport(JSON.parse(fs.readFileSync(report, "utf8")))); }
      catch (error) {
        record.status = "failed";
        record.reason = error.message;
        record.failures = [{ message: error.message }];
      }
    } else {
      record.status = "failed";
      record.reason = "No Playwright JSON report was produced";
    }
    result.storageSpecs[engine] = record;
    write();
  }

  result.finishedAt = new Date().toISOString();
  result.qualified = verdict(result);
  // Qualification of the head is not a distribution decision: releases without
  // the packaged resident runtime (--allow-unpackaged-runtime) stay non-distributable.
  const releases = (result.androidBuild?.apks ?? []).filter(row => row.mode === "release");
  result.releasesDistributable = releases.length > 0 && releases.every(row => row.distributable === true);
  write();
  console.log(`${path.join(directory, "result.json")}: ${result.qualified ? "QUALIFIED" : "NOT QUALIFIED"}; releases ${result.releasesDistributable ? "distributable" : "NOT distributable"} (${result.evidenceScope})`);
  if (!result.qualified) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
