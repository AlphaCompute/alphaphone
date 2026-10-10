/**
 * Named reasons a verify-apks release row may not be distributed.
 *
 * verify-apks decides `distributable`; this reads one recorded row back and names every
 * blocker, so a gate that refuses a release (pilot provisioning and update, AOSP staging,
 * head qualification) can say why. It is deliberately stricter than the flag: a row marked
 * distributable:true whose own recorded facts contradict it is still blocked, and a fact
 * that was never recorded counts as unresolved. An empty list is the only admissible answer.
 *
 * @param {Record<string, any>} row one `results[]` entry with mode "release"
 * @param {{manifestTestMocks?: unknown, admission?: {failures: string[], blockers: string[], signerMatches?: boolean}}} [options]
 *   admission defaults to the row's recorded releaseAdmission; pass a freshly computed one to
 *   judge the row against the current android/release-signer.json.
 * @returns {string[]}
 */
export function releaseBlockers(row, { manifestTestMocks = false, admission = row?.releaseAdmission } = {}) {
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
  const speech = row.speechQualification;
  if (!speech) blockers.push("unqualified speech (no qualification recorded)");
  else {
    const missing = [speech.byteMatch !== true && "native bytes not admitted", speech.functionalPassed !== true && "functional acceptance pending or failed",
      speech.byteMatch === true && speech.functionalPassed === true && speech.qualified !== true && "not qualified"].filter(Boolean);
    if (missing.length) blockers.push(`unqualified speech (${missing.join(", ")})`);
  }
  if (!Array.isArray(row.licenceBlockers)) blockers.push("font licence check was not recorded");
  else blockers.push(...row.licenceBlockers.map(String));
  const named = [...new Set(blockers)];
  if (row.distributable !== true && !named.length) named.push("verify-apks did not record this release as distributable");
  return named;
}
