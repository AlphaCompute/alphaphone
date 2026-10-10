import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

// Exercise production adapters over synthetic loopback HTTP. These checks do
// not establish Cloud, enclave, Android Keystore, or physical-device acceptance.
for (const script of [
  'test-remote-protocol.mjs',
  'test-connection-history.mjs',
]) {
  test(`connection contract: ${script}`, () => {
    execFileSync(process.execPath, [`scripts/${script}`], {
      cwd: new URL('..', import.meta.url),
      timeout: 60_000,
      stdio: 'pipe',
    });
  });
}
