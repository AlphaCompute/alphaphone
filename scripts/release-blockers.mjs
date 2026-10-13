/**
 * Named reasons a verify-apks release row may not be distributed.
 *
 * verify-apks decides `distributable`; this reads one recorded row back and names every
 * blocker, so a gate that refuses a release (pilot provisioning and update, AOSP staging,
 * head qualification) can say why. It is deliberately stricter than the flag: a row marked
 * distributable:true whose own recorded facts contradict it is still blocked, and a fact
 * that was never recorded counts as unresolved. An empty list is the only admissible answer.
 *
 * Open-source licences are never a blocker here (decision P-09): a row's `licenceFlags`
 * (copyleft, unknown, unverified, missing licence text) are a record, and are not read by this
 * function. The single licence item that can block is the separately named
 * `unresolved-font-licence` check for a proprietary font with no recorded licence, and only
 * while UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION (scripts/licence-policy.mjs) is true.
 *
 * @param {Record<string, any>} row one `results[]` entry with mode "release"
 * @param {{manifestTestMocks?: unknown, admission?: {failures: string[], blockers: string[], signerMatches?: boolean}, fontLicenceBlocks?: boolean}} [options]
 *   admission defaults to the row's recorded releaseAdmission; pass a freshly computed one to
 *   judge the row against the current android/release-signer.json. fontLicenceBlocks defaults
 *   to the policy constant.
 * @returns {string[]}
 */
import { UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION } from "./licence-policy.mjs";

const FONT_CHECK = /^(unresolved-font-licence: |font licence check failed: )/;

export function releaseBlockers(row, { manifestTestMocks = false, admission = row?.releaseAdmission, fontLicenceBlocks = UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION } = {}) {
  const blockers = [];
  if (manifestTestMocks !== false || row.testMocks !== false) blockers.push("test-mocks build");
  if (row.bundleAudit !== "passed") blockers.push("release did not pass the flag-off bundle audit");
  if (row.signed !== true) blockers.push("unsigned release");
  if (!admission) blockers.push("release signing admission was not recorded");
  else {
    blockers.push(...(admission.failures ?? []), ...(admission.blockers ?? []));
    if (row.signed === true && admission.signerMatches !== true && !(admission.failures?.length || admission.blockers?.length))
      blockers.push("release signer does not match android/release-signer.json");
  }
  if (row.runtime !== "PACKAGED") blockers.push(`unpackaged runtime (resident runtime ${row.runtime ?? "not recorded"})`);
  else if (row.runtimeNotices !== true) blockers.push("notices lack the packaged runtime");
  // On-device voice (fused libelizainference, android/voice-host/qualified-voice-host.json) is
  // optional: a release without it uses Cloud voice. A packaged bundle must match the record byte for
  // byte and must have recorded functional acceptance; bytes alone never qualify it.
  const voice = row.voiceHost;
  if (!voice || typeof voice !== "object" || Array.isArray(voice) || typeof voice.packaged !== "boolean")
    blockers.push("on-device voice admission was not recorded");
  else if (voice.packaged) {
    const missing = [(!Array.isArray(voice.differences) || voice.differences.length) && "bytes differ from the voice-host record",
      voice.functionalAcceptance?.passed !== true && "functional acceptance pending or failed"].filter(Boolean);
    if (missing.length) blockers.push(`unqualified on-device voice (${missing.join(", ")})`);
  }
  // The font check must have been run and recorded. Its items block only under the policy constant,
  // and only the named font check counts: no other licence text in this field is a blocker.
  if (!Array.isArray(row.licenceBlockers)) blockers.push("font licence check was not recorded");
  else if (fontLicenceBlocks) blockers.push(...row.licenceBlockers.map(String).filter(item => FONT_CHECK.test(item)));
  const named = [...new Set(blockers)];
  if (row.distributable !== true && !named.length) named.push("verify-apks did not record this release as distributable");
  return named;
}
