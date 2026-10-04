import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('APK provenance rejects mixed, incomplete and altered runtime payloads', () => {
  execFileSync('python3', ['test/packaged-runtime.test.py'], {
    cwd: new URL('..', import.meta.url), timeout: 20000, stdio: 'pipe',
  });
});
