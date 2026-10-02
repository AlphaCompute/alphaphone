/** Read-only admission before credentials, user creation or APK installation. */
export function admitResidentEmulator(environment, adb) {
  if (environment.ALPHA_RESIDENT_DISPOSABLE_EMULATOR !== '1' ||
      !/^emulator-\d+$/.test(environment.ANDROID_SERIAL || '')) {
    throw Error('Explicit disposable emulator selection required');
  }
  if (adb(['shell', 'getprop', 'ro.kernel.qemu']).trim() !== '1' ||
      adb(['shell', 'getprop', 'ro.product.cpu.abi']).trim() !== 'arm64-v8a') {
    throw Error('Resident provider fixture requires an ARM64 emulator');
  }
  const packages = adb(['shell', 'pm', 'list', 'packages', '-u']).trim().split(/\r?\n/).filter(Boolean);
  if (!packages.length || packages.some(row => !/^package:[\w.]+$/.test(row)) ||
      packages.some(row => /^package:ai\.elizaresearch\.alphaphone(?:\.test)?$/.test(row))) {
    throw Error('Use a fresh emulator without an existing Alpha Phone installation');
  }
}
