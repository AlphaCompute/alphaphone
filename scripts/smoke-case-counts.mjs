// AndroidJUnitRunner reports ignored cases, but JUnit excludes them from Tests run.
export function smokeCaseCounts(instrumentation) {
  const terminalCases = [];
  const startedCases = [];
  let statusBlock = "";
  let malformedCaseStatus = false;
  for (const line of instrumentation.replace(/\r\n?/g, "\n").split("\n")) {
    const code = /^INSTRUMENTATION_STATUS_CODE: (-?\d+)\s*$/.exec(line);
    if (!code) { statusBlock += line + "\n"; continue; }
    const testClass = /^INSTRUMENTATION_STATUS: class=(.+)$/m.exec(statusBlock)?.[1];
    const testMethod = /^INSTRUMENTATION_STATUS: test=(.+)$/m.exec(statusBlock)?.[1];
    const value = Number(code[1]);
    if ((value === 1 || value <= 0) && (!testClass || !testMethod))
      malformedCaseStatus = true;
    if (testClass && testMethod && value === 1)
      startedCases.push(`${testClass}#${testMethod}`);
    if (testClass && testMethod && value <= 0)
      terminalCases.push({ selector: `${testClass}#${testMethod}`, code: value });
    statusBlock = "";
  }
  const testCounts = {
    passed: terminalCases.filter(row => row.code === 0).length,
    failed: terminalCases.filter(row => row.code === -1 || row.code === -2).length,
    ignored: terminalCases.filter(row => row.code === -3).length,
    assumptionSkipped: terminalCases.filter(row => row.code === -4).length,
    unknown: terminalCases.filter(row => ![0,-1,-2,-3,-4].includes(row.code)).length,
  };
  const reportedCount = Number(/(?:OK \(|Tests run: )(\d+)/.exec(instrumentation)?.[1]);
  const countsVerified = Number.isSafeInteger(reportedCount) && reportedCount > 0 &&
    reportedCount === terminalCases.length - testCounts.ignored &&
    startedCases.length === terminalCases.length &&
    new Set(startedCases).size === startedCases.length &&
    terminalCases.every(row => startedCases.includes(row.selector)) &&
    new Set(terminalCases.map(row => row.selector)).size === terminalCases.length &&
    testCounts.unknown === 0 && !malformedCaseStatus;
  return {terminalCases, startedCases, testCounts, reportedCount, countsVerified};
}
