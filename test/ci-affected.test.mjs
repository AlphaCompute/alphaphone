import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

// Exercise the actual Actions entry point, complete Git history and output files.
test('CI selection follows changed files, renames, missing history and manual dispatch', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'alpha-ci-selection-'));
  t.after(() => rmSync(cwd, {recursive:true, force:true}));
  const git = (...args) => execFileSync('git', args, {cwd, encoding:'utf8'}).trim();
  git('init', '-q'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'CI fixture');
  const put = (name, text='fixture\n') => {
    mkdirSync(join(cwd, name, '..'), {recursive:true}); writeFileSync(join(cwd, name), text);
  };
  put('apps/app/source.ts'); put('test/browser/notes.spec.ts'); put('test/browser/production-surface.spec.ts');
  git('add', '.'); git('commit', '-qm', 'base');
  let base = git('rev-parse', 'HEAD');
  const select = (event, eventName='pull_request', sha=git('rev-parse','HEAD')) => {
    const eventPath=join(cwd,'event.json'), output=join(cwd,'output'), summary=join(cwd,'summary');
    writeFileSync(eventPath, JSON.stringify(event)); writeFileSync(output,''); writeFileSync(summary,'');
    execFileSync(process.execPath, [resolve('scripts/ci/affected.mjs')], {cwd, encoding:'utf8', env:{...process.env,
      GITHUB_EVENT_PATH:eventPath, GITHUB_EVENT_NAME:eventName, GITHUB_SHA:sha, GITHUB_OUTPUT:output, GITHUB_STEP_SUMMARY:summary}});
    assert.match(readFileSync(summary,'utf8'), /Change selection/);
    return Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(line=>{
      const i=line.indexOf('='); return [line.slice(0,i),JSON.parse(line.slice(i+1))];
    }));
  };
  const commit = name => {git('add', ...(name==='.'?['-u']:[name]));git('commit','-qm','change '+name);};
  const pr = () => ({pull_request:{base:{sha:base},head:{sha:git('rev-parse','HEAD')}}});
  const lanes = result => [result.verify,result.browser,result.android,result.prepare];
  put('docs/reference.md');commit('docs'); assert.deepEqual(lanes(select(pr())),[false,false,false,false]);
  base=git('rev-parse','HEAD');put('test/browser/notes.spec.ts','changed\n');commit('test');
  let result=select(pr());assert.deepEqual(lanes(result),[true,true,false,false]);
  assert.deepEqual(result.browser_specs,['test/browser/notes.spec.ts']);assert.deepEqual(result.browser_shards,[1]);
  assert.equal(result.browser_production,false);assert.equal(result.browser_speech,false);
  base=git('rev-parse','HEAD');put('test/browser/production-surface.spec.ts','changed\n');commit('test');
  result=select(pr());assert.equal(result.browser_development,false);assert.equal(result.browser_production,true);
  base=git('rev-parse','HEAD');git('mv','apps/app/source.ts','docs/reference.ts');commit('.');
  result=select(pr());assert.deepEqual(lanes(result),[true,true,true,false]);assert.deepEqual(result.browser_specs,[]);
  base=git('rev-parse','HEAD');git('rm','test/browser/notes.spec.ts');commit('.');
  result=select(pr());assert.deepEqual(result.browser_shards,[1,2,3]);assert.equal(result.browser_production,true);
  base=git('rev-parse','HEAD');put('unknown-build-input');commit('unknown-build-input');
  assert.deepEqual(lanes(select({before:base},'push')),[true,true,true,true]);
  assert.deepEqual(lanes(select({before:'0'.repeat(40)},'push')),[true,true,true,true]);
  assert.deepEqual(lanes(select({},'workflow_dispatch')),[true,true,true,true]);
});
