import { requireHostedFixtureEnvironment, assertFixtureIdentity } from './ci-emulator-display.mjs';

// Retain only capability booleans, never addresses, SSIDs or network identifiers.
export function parseFixtureNetwork(text) {
  const defaults = [...text.matchAll(/^Active default network: (\S+)\s*$/gm)];
  if (defaults.length !== 1 || !/^(?:none|\d+)$/.test(defaults[0][1]))
    throw new Error('Unknown fixture default network state');
  const id = defaults[0][1];
  if (id === 'none') return { active: false, internet: false, validated: false };
  const networks = text.split(/\r?\n/).filter(line => line.trimStart().startsWith(`NetworkAgentInfo{network{${id}} `));
  if (networks.length !== 1) throw new Error('Unknown fixture active network capabilities');
  const capabilities = /\bnc\{\[.*?\bCapabilities: ([^\]]+)/.exec(networks[0]);
  if (!capabilities) throw new Error('Unknown fixture active network capabilities');
  const names = capabilities[1].split(/\s/)[0].split('&');
  return { active: true, internet: names.includes('INTERNET'), validated: names.includes('VALIDATED') };
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function prepareFixtureNetwork(run, { env = process.env, serial, sleep = delay, record = () => {} } = {}) {
  const admit = () => {
    requireHostedFixtureEnvironment(env, serial);
    assertFixtureIdentity(run);
    // Provider preparation is the only allowed prior install. Never provision
    // connectivity on a populated emulator, a user's device or a secondary user.
    const packages = run('shell', 'pm', 'list', 'packages', '-3').trim().split(/\r?\n/).filter(Boolean);
    if (packages.some(value => value !== 'package:com.android.webview'))
      throw new Error('Fresh network fixture required');
  };
  admit();
  const before = parseFixtureNetwork(run('shell', 'dumpsys', 'connectivity'));
  record({ phase: 'before', ...before });
  if (!before.active || !before.internet || !before.validated) {
    // The SDK emulator owns this open virtual AP. Configure it once, before
    // measuring real requests; never retry or replace failed product operations.
    admit();
    run('shell', 'cmd', 'wifi', 'set-wifi-enabled', 'enabled');
    admit();
    run('shell', 'cmd', 'wifi', 'connect-network', 'AndroidWifi', 'open');
  }
  let consecutive = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    admit();
    const state = parseFixtureNetwork(run('shell', 'dumpsys', 'connectivity'));
    record({ phase: 'admission', attempt, ...state });
    consecutive = state.active && state.internet && state.validated ? consecutive + 1 : 0;
    if (consecutive === 2) return state;
    await sleep(500);
  }
  throw new Error('Disposable emulator has no validated Internet network');
}
