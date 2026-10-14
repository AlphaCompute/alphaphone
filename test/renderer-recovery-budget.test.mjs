// Renderer recovery (AP-02). Host-JVM run of the extracted budget plus a source check that
// MainActivity uses it. Not emulator evidence: killing the renderer on a device is the separate
// instrumented task (renderer-recovery-emulator), and the escape view has not been seen on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeSource,fixture,runJvm} from './fixtures/jvm-tools.mjs';

test('three immediate recoveries per 60 s, then a 5 s backoff, or the escape view while HOME',()=>{
 assert.match(runJvm([nativeSource('RendererRecoveryBudget.java'),fixture('RendererRecoveryBudgetTest.java')],'ai.elizaresearch.alphaphone.RendererRecoveryBudgetTest'),/^PASS renderer recovery budget/);
});

test('MainActivity routes every renderer loss through the budget and offers stock Settings only',()=>{
 const source=readFileSync(nativeSource('MainActivity.java'),'utf8');
 const gone=source.slice(source.indexOf('public boolean onRenderProcessGone('),source.indexOf('/*\n  * One live MainActivity'));
 assert.match(gone,/recoveryBudget\.onLoss\(SystemClock\.elapsedRealtime\(\), showsHome\(\)\)/);
 assert.match(gone,/if \(action == RendererRecoveryBudget\.Action\.SHOW_ESCAPE\) \{ showRendererEscape\(\); return true; \}/);
 assert.match(gone,/RendererRecoveryBudget\.delay\(action\)/);
 assert.doesNotMatch(source,/rendererRecoveryDelay|RECOVERY_BUDGET/,'the old in-activity budget is gone');
 assert.match(source,/private boolean showsHome\(\) \{ return BuildConfig\.IS_LAUNCHER && !isAssistantSurface\(\) && startedAsHome; \}/);
 const escape=source.slice(source.indexOf('private void showRendererEscape()'),source.indexOf('private void addEscapeButton('));
 for(const label of ['"Reload"','"Open Android Settings"','"Choose Home app"'])assert.ok(escape.includes(label),`escape view offers ${label}`);
 assert.match(escape,/RendererRecoveryBudget\.settingsAction\(resolves\)/);
 assert.match(escape,/RendererRecoveryBudget\.homeChoiceAction\(resolves\)/);
 assert.doesNotMatch(escape,/setClass|setComponent|setPackage|MainActivity\.class/,'Settings buttons never target an Alpha activity');
});
