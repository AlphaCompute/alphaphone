// Release-build data integrity export as pilot-update reads it, on synthetic `content query`
// output. Not emulator or device evidence: an emulator run of the export is separate (class E).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { compareDomains, integrityQuery, INTEGRITY_AUTHORITY, parseIntegrityExport } from "../scripts/pilot-update.mjs";

const NONCE = "ab".repeat(32);
const hmac = (value, nonce = NONCE) => createHmac("sha256", Buffer.from(nonce, "ascii")).update(value).digest("hex");
/** What the provider returns: one row per file and an end row with the count, as `content query` prints them. */
function exported(files, nonce = NONCE) {
  const rows = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([relative, bytes]) => {
    const domain = relative.includes("/") ? relative.slice(0, relative.indexOf("/")) : ".";
    return `domain=${domain}, key=${hmac(`path:${relative}`, nonce)}, digest=${hmac(bytes, nonce)}`;
  });
  rows.push(`domain=#end, key=${rows.length}, digest=${hmac(`count:${rows.length}`, nonce)}`);
  return rows.map((row, index) => `Row: ${index} ${row}`).join("\n") + "\n";
}

const DATA = {
  "files/notes/document.json": "{\"notes\":[1]}", "no_backup/connection-credentials/slot.bin": "sealed",
  "databases/androidx.work.workdb": "work", "shared_prefs/alpha.xml": "<map/>", "root-file": "x",
};

test("the export query is the read-only provider URI with a nonce, quoted for the device shell", () => {
  assert.equal(INTEGRITY_AUTHORITY, "ai.elizaresearch.alphaphone.integrity");
  assert.deepEqual(integrityQuery(NONCE), ["shell", "content", "query", "--uri", `'content://ai.elizaresearch.alphaphone.integrity/domains?nonce=${NONCE}'`]);
  for (const nonce of ["", "abc", "z".repeat(64), `${NONCE}'; rm -rf /`]) assert.throws(() => integrityQuery(nonce), /nonce/);
});

test("export rows parse into per-domain inventories keyed by path digest; no names or contents appear", () => {
  const output = exported(DATA);
  const domains = parseIntegrityExport(output);
  assert.deepEqual(Object.keys(domains).sort(), [".", "databases", "files", "no_backup", "shared_prefs"]);
  assert.equal(domains.files[`files/${hmac("path:files/notes/document.json")}`], hmac(DATA["files/notes/document.json"]));
  assert.equal(Object.values(domains).reduce((total, files) => total + Object.keys(files).length, 0), 5);
  for (const secret of ["document.json", "slot.bin", "sealed", "notes"]) assert.ok(!output.includes(secret), secret);
  assert.deepEqual(compareDomains(domains, parseIntegrityExport(exported(DATA))), [], "the same data under the same nonce is identical");
});

test("a lost, changed or new file after the update is reported per domain", () => {
  const before = parseIntegrityExport(exported(DATA));
  const changed = { ...DATA, "shared_prefs/alpha.xml": "<map><x/></map>", "databases/new.db": "new" };
  delete changed["files/notes/document.json"];
  const problems = compareDomains(before, parseIntegrityExport(exported(changed)));
  assert.deepEqual(problems, [
    `databases/${hmac("path:databases/new.db")} appeared`,
    `files/${hmac("path:files/notes/document.json")} was lost`,
    `shared_prefs/${hmac("path:shared_prefs/alpha.xml")} changed`,
  ].sort());
  // A different nonce for the second read would make every file look replaced: the update uses one nonce.
  assert.equal(compareDomains(before, parseIntegrityExport(exported(DATA, "cd".repeat(32)))).length, 10);
});

test("a refused, failed, truncated or malformed export never reads as an unchanged inventory", () => {
  assert.equal(parseIntegrityExport("Error while accessing provider:ai.elizaresearch.alphaphone.integrity\njava.lang.IllegalArgumentException: Could not find provider"), null);
  assert.equal(parseIntegrityExport("[ERROR] Unknown authority ai.elizaresearch.alphaphone.integrity"), null, "an older build without the export");
  assert.throws(() => parseIntegrityExport("Error while accessing provider:x\njava.lang.SecurityException: Permission Denial: opening provider requires android.permission.DUMP"), /Integrity export failed/);
  assert.throws(() => parseIntegrityExport("java.lang.IllegalStateException: Integrity export failed: IOException"), /Integrity export failed/);
  const output = exported(DATA);
  assert.throws(() => parseIntegrityExport(output.split("\n").filter(line => !line.includes("#end")).join("\n")), /no end row/);
  assert.throws(() => parseIntegrityExport(output.split("\n").filter((_, index) => index !== 1).join("\n")), /lists 4 files but its end row says 5/);
  assert.throws(() => parseIntegrityExport(`Row: 0 domain=files, key=12, digest=${"0".repeat(64)}\nRow: 1 domain=#end, key=1, digest=${"0".repeat(64)}`), /Malformed integrity export row/);
  assert.throws(() => parseIntegrityExport(""), /no end row/);
});

test("the provider is a registered, read-only, DUMP-protected release component, not a debug or mock surface", () => {
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  const provider = /<provider android:name="\.release\.DataIntegrityProvider"[^>]*>/.exec(manifest)?.[0];
  assert.ok(provider, "registered in the main manifest, so release builds carry it");
  assert.match(provider, /android:authorities="\$\{applicationId\}\.integrity"/);
  assert.match(provider, /android:permission="android\.permission\.DUMP"/);
  assert.match(provider, /android:process=":integrity"/);
  assert.match(provider, /android:grantUriPermissions="false"/);
  const source = fs.readFileSync("android/app/src/main/java/ai/elizaresearch/alphaphone/release/DataIntegrityProvider.java", "utf8");
  assert.doesNotMatch(source, /BuildConfig\.DEBUG|ELIZA_DEV_ALLOW_TEST_MOCKS|isDebuggable/);
  assert.match(source, /HmacSHA256/);
  for (const write of ["insert", "delete", "update"]) assert.match(source, new RegExp(`public (?:Uri|int) ${write}\\([^)]*\\)\\{throw new UnsupportedOperationException`));
  assert.match(source, /List\.of\("cache", "code_cache"\)/);
  const apk = fs.readFileSync("scripts/apk.mjs", "utf8");
  assert.match(apk, /"ai\.elizaresearch\.alphaphone\.release\.DataIntegrityProvider": "android\.permission\.DUMP"/);
  assert.ok(!fs.existsSync("android/app/src/testMocks/java/ai/elizaresearch/alphaphone/release"), "no test-mocks variant of the export");
});
