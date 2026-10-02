import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitResidentEmulator, removeResidentFixtureUser } from '../scripts/resident-emulator-admission.mjs';

const environment = { ALPHA_RESIDENT_DISPOSABLE_EMULATOR: '1', ANDROID_SERIAL: 'emulator-5554' };
function fixture({ qemu = '1', abi = 'arm64-v8a', packages = 'package:android' } = {}) {
  const calls = [];
  return { calls, adb(args) {
    calls.push(args);
    assert.ok(args[1] === 'getprop' || args.slice(0, 4).join(' ') === 'shell pm list packages');
    return args[2] === 'ro.kernel.qemu' ? qemu : args[2] === 'ro.product.cpu.abi' ? abi : packages;
  } };
}
test('rejects missing consent and physical serial before accessing the device', () => {
  for (const env of [{ ANDROID_SERIAL: 'emulator-5554' }, { ...environment, ANDROID_SERIAL: 'physical-phone' }]) {
    const device = fixture();
    assert.throws(() => admitResidentEmulator(env, device.adb), /Explicit disposable/);
    assert.equal(device.calls.length, 0);
  }
});
test('fixture cleanup preserves changed ownership and rejects unconfirmed removal', () => {
  const name = 'alpha-resident-12345678-1234-4234-8234-123456789abc';
  for (const issue of ['renamed', 'foreground', 'remove-failed', 'retained', 'missing-inventory', 'none']) {
    let removed = false;
    const adb = args => {
      const command = args.join(' ');
      if (command === 'shell pm list users') return issue === 'missing-inventory' ? '' :
        'UserInfo{0:Owner:13}\n' + (!removed || issue === 'retained' ? `UserInfo{10:${issue === 'renamed' ? 'someone-else' : name}:10}` : '');
      if (command === 'shell am get-current-user') return issue === 'foreground' ? '10' : '0';
      assert.equal(command, 'shell pm remove-user 10');
      assert.ok(!['renamed', 'foreground', 'missing-inventory'].includes(issue));
      removed = true;
      return issue === 'remove-failed' ? 'Error: user retained' : 'Success: removed user';
    };
    if (issue === 'none') removeResidentFixtureUser(adb, '10', name);
    else assert.throws(() => removeResidentFixtureUser(adb, '10', name));
    if (['renamed', 'foreground', 'missing-inventory'].includes(issue)) assert.equal(removed, false);
  }
});
test('requires emulator identity and preserves existing package installations across users', () => {
  for (const options of [{ qemu: '0' }, { abi: 'x86_64' }, { packages: '' },
    { packages: 'Error: package manager unavailable' },
    { packages: 'package:android\npackage:ai.elizaresearch.alphaphone' },
    { packages: 'package:android\npackage:ai.elizaresearch.alphaphone.test' }]) {
    assert.throws(() => admitResidentEmulator(environment, fixture(options).adb));
  }
  const device = fixture();
  admitResidentEmulator(environment, device.adb);
  assert.deepEqual(device.calls.at(-1), ['shell', 'pm', 'list', 'packages', '-u']);
});
