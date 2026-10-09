import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('an independently rebuilt speech runtime is admitted only after the unchanged canonical test passes on every ABI', () => {
  execFileSync('python3', ['test/local-speech-requalify.test.py'], {
    cwd: new URL('..', import.meta.url), timeout: 60000, stdio: 'pipe',
  });
});
