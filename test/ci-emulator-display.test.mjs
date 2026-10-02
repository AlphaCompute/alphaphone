import test from "node:test";
import assert from "node:assert/strict";
import { parseFixtureDisplay, prepareFixtureDisplay, requireFixtureDisplay } from "../scripts/ci-emulator-display.mjs";
const env = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted" };
const policy = ({ showing = true, restricted = true, secure = false } = {}) => `KeyguardServiceDelegate
 showing=${showing}
 inputRestricted=false
 secure=${secure}
 systemIsReady=true
 bootCompleted=true
 screenState=SCREEN_STATE_ON
 KeyguardStateMonitor
 mCurrentUserId=0
 mIsShowing=${showing}
 mInputRestricted=${restricted}
`;
function fixture({ secure = false, neverUnlock = false, thirdParty = false, user = "0" } = {}) {
  const commands = []; let disabled = false, dismissed = false, displayReads = 0, policyReads = 0;
  const run = (...args) => {
    const cmd = args.join(" "); commands.push(cmd);
    if (cmd === "emu avd name") return "test\nOK";
    if (cmd === "shell getprop ro.kernel.qemu") return "1";
    if (cmd === "shell getprop ro.build.type") return "userdebug";
    if (cmd === "shell am get-current-user") return user;
    if (cmd === "shell pm list users") return "Users:\n UserInfo{0:Owner:4c13} running";
    if (cmd === "shell pm list packages -3") return thirdParty ? "package:some.existing.app" : "";
    if (cmd === "shell dumpsys power") return " mWakefulness=Awake\n";
    if (cmd === "shell dumpsys window policy") {
      if (dismissed) displayReads++;
      // A successful dismiss command does not immediately dismiss keyguard.
      const showing = !dismissed || neverUnlock || displayReads < 3;
      return policy({
        showing,
        restricted: showing,
        secure: Array.isArray(secure) ? secure[Math.min(policyReads++, secure.length - 1)] : secure,
      });
    }
    if (cmd === "shell locksettings get-disabled --user 0") return String(disabled);
    if (cmd === "shell locksettings set-disabled --user 0 true") { disabled = true; return "Lock screen disabled set to true"; }
    if (cmd === "shell wm dismiss-keyguard") { dismissed = true; return ""; }
    if (["shell svc power stayon true", "shell input keyevent KEYCODE_WAKEUP", "shell input keyevent KEYCODE_HOME"].includes(cmd)) return "";
    throw new Error(`Unexpected command: ${cmd}`);
  };
  return { run, commands };
}
const mutations = commands => commands.filter(command => /set-disabled|stayon|keyevent|dismiss-keyguard/.test(command));
test("actual locked CI policy remains rejected despite awake screen and delegate inputRestricted=false", () => {
  const state = parseFixtureDisplay("mWakefulness=Awake\n", policy());
  assert.equal(state.awake, true); assert.equal(state.displayOn, true);
  assert.equal(state.unlocked, false); assert.equal(state.unrestricted, false);
  assert.equal(parseFixtureDisplay("mWakefulness=Awake", "").secure, null);
});
test("fresh hosted fixture waits for observed consecutive unlock after successful dismissal", async () => {
  const f = fixture(), observations = [];
  const state = await prepareFixtureDisplay(f.run, { env, serial: "emulator-5554", sleep: async () => {}, record: value => observations.push(value) });
  assert.equal(state.unlocked, true);
  const admission = observations.filter(row => row.phase === "display-admission");
  assert.deepEqual(admission.map(row => row.unlocked), [false, false, true, true]);
  assert.equal(mutations(f.commands).filter(cmd => cmd.includes("set-disabled")).length, 1);
  assert.deepEqual(observations.find(row => row.phase === "lockscreen-policy"), { phase: "lockscreen-policy", user: "0", priorDisabled: "false", installedDisabled: "true" });
});
test("secure, nonfresh and other-user fixtures fail before any mutation", async () => {
  for (const options of [{ secure: true }, { thirdParty: true }, { user: "10" }]) {
    const f = fixture(options);
    await assert.rejects(prepareFixtureDisplay(f.run, { env, serial: "emulator-5554", sleep: async () => {} }));
    assert.deepEqual(mutations(f.commands), []);
  }
});
test("local, self-hosted and wrong-serial contexts execute no device command", async () => {
  for (const options of [{ env: {}, serial: "emulator-5554" }, { env: { ...env, RUNNER_ENVIRONMENT: "self-hosted" }, serial: "emulator-5554" }, { env, serial: "emulator-5562" }]) {
    const f = fixture(); await assert.rejects(prepareFixtureDisplay(f.run, options)); assert.deepEqual(f.commands, []);
  }
});
test("read-only preflight does not repair or ignore a locked display", async () => {
  const f = fixture({ neverUnlock: true }); let waits = 0;
  await assert.rejects(requireFixtureDisplay(f.run, { env, serial: "emulator-5554", sleep: async () => { waits++; } }), /not observed awake/);
  assert.equal(waits, 30); assert.deepEqual(mutations(f.commands), []);
});

// Preparation orchestration: conservative secure observations never authorize writes.
test("false then true at the final credential check refuses every mutation", async () => {
  const f = fixture({ secure: [false, true] });
  await assert.rejects(
    prepareFixtureDisplay(f.run, { env, serial: "emulator-5554", sleep: async () => {} }),
    /admission changed/,
  );
  assert.deepEqual(mutations(f.commands), []);
});
test("initial true remains fail-closed even when later fixture reads would be false", async () => {
  for (const secure of [[true, true], [true, false]]) {
    const f = fixture({ secure });
    await assert.rejects(
      prepareFixtureDisplay(f.run, { env, serial: "emulator-5554", sleep: async () => {} }),
      /Secure credential state/,
    );
    assert.deepEqual(mutations(f.commands), []);
  }
});

import fs from 'node:fs';
const unbound = fs.readFileSync(new URL('./fixtures/keyguard-unbound-637c28d.txt', import.meta.url), 'utf8');
test('captured637 delegate defaults are unready until user0 monitor binds', async () => {
  const parsed = parseFixtureDisplay('mWakefulness=Awake', unbound);
  assert.equal(parsed.secure, true); assert.equal(parsed.monitorBound, false); assert.equal(parsed.ready, false);
  const f = fixture(); let reads = 0, waits = 0;
  const run = (...args) => args.join(' ') === 'shell dumpsys window policy' && reads++ < 2 ? unbound : f.run(...args);
  const result = await prepareFixtureDisplay(run, { env, serial: 'emulator-5554', sleep: async () => { waits++; assert.ok(waits <= 30); } });
  assert.equal(result.unlocked, true); assert.ok(waits >= 2);
});
test('unbound malformed and bound-secure observations never permit mutations', async () => {
  for (const value of [policy().replace('secure=false', 'secure=unknown'), policy().replace('mInputRestricted=true', 'mInputRestricted=unknown'), unbound, unbound.replace('secure=true', 'secure=false'), policy().replace('mCurrentUserId=0', 'mCurrentUserId=10'), policy({secure:true})]) {
    const f = fixture(); let waits = 0;
    const run = (...args) => args.join(' ') === 'shell dumpsys window policy' ? value : f.run(...args);
    await assert.rejects(prepareFixtureDisplay(run, {env, serial:'emulator-5554', sleep:async()=>{waits++;}}));
    assert.deepEqual(mutations(f.commands), []);
    assert.equal(waits, value === unbound ? 30 : 0);
  }
});
test('readiness and unlock share the original30-attempt admission budget', async () => {
  const f = fixture({neverUnlock:true}); let reads = 0, waits = 0;
  const run = (...args) => args.join(' ') === 'shell dumpsys window policy' && reads++ < 20 ? unbound : f.run(...args);
  await assert.rejects(prepareFixtureDisplay(run, {env, serial:'emulator-5554', sleep:async()=>{waits++;}}), /not observed awake/);
  assert.equal(waits, 29); //20 startup waits +9 remaining unlock attempts; ready observation consumes one.
});
test('malformed prewrite observation cannot mutate an initially ready fixture', async () => {
 const f=fixture();let reads=0;
 const run=(...args)=>args.join(' ')==='shell dumpsys window policy'&&++reads===2?policy().replace('mInputRestricted=true','mInputRestricted=unknown'):f.run(...args);
 await assert.rejects(prepareFixtureDisplay(run,{env,serial:'emulator-5554',sleep:async()=>{}}),/admission changed/);
 assert.deepEqual(mutations(f.commands),[]);
});
test('independent readonly admission rejects persistent sentinel and bound secure state',async()=>{
 for(const [value,expectedWaits]of [[unbound,30],[policy({secure:true}),0]]){
  const f=fixture();let waits=0;
  const run=(...args)=>args.join(' ')==='shell dumpsys window policy'?value:f.run(...args);
  await assert.rejects(requireFixtureDisplay(run,{env,serial:'emulator-5554',sleep:async()=>{waits++;}}));
  assert.equal(waits,expectedWaits);assert.deepEqual(mutations(f.commands),[]);
 }
});
