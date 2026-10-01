import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
// Actual product adapters, bounded HTTP/native fixtures. No provider writes or Android builds.
for (const script of [
  'test-calendar-crud-review.mjs', 'test-calendar-query-race.mjs',
  'test-reminder-time-flow.mjs', 'test-clock-handoff-flow.mjs',
  'test-cloud-voice-flow.mjs', 'test-inbox-cloud-flow.mjs',
  'test-device-actions.mjs', 'test-workflow-protocol.mjs',
  'test-workflow-ui-flow.mjs', 'test-workflow-approval-ui-flow.mjs',
  'test-workflow-lifecycle-ui-flow.mjs', 'test-workflow-metadata-ui-flow.mjs',
  'test-notes-store-flow.ts', 'test-notes-action-flow.ts',
]) {
  test(`adapter contract: ${script}`, () => {
    execFileSync(process.execPath, ['--import', 'tsx', '--experimental-transform-types', `scripts/${script}`], {
      cwd: new URL('..', import.meta.url), timeout: 60_000, stdio: 'pipe',
    });
  });
}
