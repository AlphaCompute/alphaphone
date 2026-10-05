import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('speech wrappers pin the qualified toolchain and refuse runtimes that differ from the record', () => {
  execFileSync('python3', ['test/local-speech-toolchain.test.py'], {
    cwd: new URL('..', import.meta.url), timeout: 20000, stdio: 'pipe',
  });
});
