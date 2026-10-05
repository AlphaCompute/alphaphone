import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {requireInstrumentationSuccess} from './instrumentation-result.mjs';

/** Product campaign progress and private stdin; Node owns bounded child execution. */
export function createCombinedDeviceRunner({adb, serial, env, timeout = 900000, maxBuffer = 2_000_000, onStage = stage => console.log('Combined stage: ' + stage)}) {
  assert.match(serial, /^emulator-\d+$/);
  assert.ok(Number.isSafeInteger(timeout) && timeout > 0);
  assert.ok(Number.isSafeInteger(maxBuffer) && maxBuffer > 0);
  return (args, input) => new Promise((resolve, reject) => {
    let inputFailed = false;
    const child = execFile(adb, ['-s', serial, ...args], {
      env, encoding: 'utf8', timeout, maxBuffer, killSignal: 'SIGKILL',
    }, (error, stdout) => {
      // Do not expose arguments, fixture stdin or captured output in errors.
      // Local child termination does not establish a remote operation's outcome.
      if (error || inputFailed) reject(new Error('Combined device command failed or exceeded its execution bound'));
      else resolve(stdout);
    });
    let pending = '';
    child.stdout.on('data', chunk => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop().slice(-160);
      for (const line of lines) {
        const stage = /combinedStage=([a-z][a-z0-9-]{0,80})\r?$/.exec(line);
        if (stage) onStage(stage[1]);
      }
    });
    child.stdin.on('error', () => { inputFailed = true; child.kill('SIGKILL'); });
    child.stdin.end(input);
  });
}

/** A summary alone cannot prove that the requested product method ran. */
export function requireCombinedCase(output, app, className, method) {
  const cls = `${app}.${className}`;
  assert.equal(typeof output, 'string');
  assert.ok(Buffer.byteLength(output) <= 2_000_000, 'Combined output exceeds bound');
  const text = output.replace(/\r\n?/g, '\n');
  const terminal = text.indexOf('INSTRUMENTATION_CODE:');
  const boundary = terminal < 0 ? text.length : terminal;
  // These product-owned advisory bundles are not JUnit completion records.
  // Strip only their exact shape before the final result; all other statuses
  // remain subject to the upstream parser's identity and completion checks.
  const evidence = text.slice(0, boundary).replace(
    /^INSTRUMENTATION_STATUS: combinedStage=[a-z][a-z0-9-]{0,80}\nINSTRUMENTATION_STATUS_CODE: 0\n/gm, '',
  ) + text.slice(boundary);
  const result = requireInstrumentationSuccess(evidence, [cls]);
  assert.deepEqual(result.cases, [`${cls}#${method}`]);
  return result;
}
