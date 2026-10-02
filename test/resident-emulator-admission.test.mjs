import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitResidentEmulator } from '../scripts/resident-emulator-admission.mjs';

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
