import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// The Cloud delegation return page runs one inline script, admitted only by its hash.
test('delegation return page CSP admits exactly its inline script',()=>{
  const html=readFileSync('apps/app/public/delegation-return.html','utf8');
  const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);
  assert.equal(scripts[0][1],'');
  const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(policy,'CSP meta is present');
  const hash=createHash('sha256').update(scripts[0][2]).digest('base64');
  assert.match(policy,/(^|; )default-src 'none'(;|$)/);
  assert.match(policy,new RegExp(`(^|; )script-src 'sha256-${hash.replace(/[+/=]/g,c=>'\\'+c)}'(;|$)`));
  assert.doesNotMatch(policy,/unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.match(policy,/base-uri 'none'/);
  // The meta must precede the script so it applies to it.
  assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<script'));
});
