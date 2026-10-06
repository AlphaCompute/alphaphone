import { smokeCaseCounts } from "./smoke-case-counts.mjs";
export const videoMethods = [
  "recordsDurableVideoAndPrototypeControlsDriveRealPlayback",
  "leavingCameraFinalizesInsteadOfRecordingInBackground",
];
export function requireVideoCases(text, appId) {
  const result = smokeCaseCounts(text);
  const expected = videoMethods.map(method => `${appId}.VideoInstrumentedTest#${method}`);
  if (!result.countsVerified || result.reportedCount !== expected.length ||
      !expected.every(selector => result.terminalCases.some(row => row.selector === selector && row.code === 0)) ||
      !/OK \(2 tests\)/.test(text) || /FAILURES|INSTRUMENTATION_FAILED/.test(text))
    throw new Error("Both actual video cases must pass without skips or duplicate results");
  return result;
}
export function requireStockVideoEvidence(receipt, { serial, runId, runAttempt, artifactHashes, appId }) {
  const names = ["standalone", "launcher"].flatMap(variant => ["debug", "androidTest"].map(kind => `${variant}-${kind}.apk`));
  if (!runId || !runAttempt || names.some(name => !/^[a-f0-9]{64}$/.test(artifactHashes[name] ?? "")))
    throw new Error("Complete same-run APK identity required");
  if (receipt.status !== "passed" || receipt.serial !== serial || receipt.runId !== runId || receipt.runAttempt !== runAttempt ||
      receipt.provider?.package !== "com.android.webview" || !/^124\./.test(receipt.provider?.version ?? "") ||
      !/^[a-f0-9]{64}$/.test(receipt.provider?.sha256 ?? "") || receipt.cleanupVerified !== true)
    throw new Error("Same-run stock WebView video qualification required");
  for (const [name, digest] of Object.entries(artifactHashes))
    if (receipt.artifactHashes?.[name] !== digest) throw new Error("Stock video evidence APK differs from current bundle");
  for (const variant of ["standalone", "launcher"])
    requireVideoCases(receipt.variants?.[variant]?.instrumentation ?? "", appId);
  return receipt;
}
