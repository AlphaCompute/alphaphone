// J05 native half: page-reading refusals carry stable reject codes so the renderer (WP6) never parses
// message text. Class S only; the refusals themselves are covered by the instrumented
// BrowserIsolatedReading and BrowserSensitiveReading classes, not run here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeSource} from './fixtures/jvm-tools.mjs';

test('isolated-world and sensitive-page refusals use distinct codes and keep their messages',()=>{
 const source=readFileSync(nativeSource('BrowserReading.java'),'utf8');
 assert.match(source,/static final String ISOLATED_WORLD_UNAVAILABLE="isolated-world-unavailable",SENSITIVE_PAGE="sensitive-page";/);
 assert.match(source,/ISOLATED_MESSAGE="Isolated page reading is unavailable\. Update Android System WebView, then reload this page\.";/,'the existing message is kept');
 const review=source.slice(source.indexOf('private void review(PluginCall call'),source.indexOf('private void scheduleTimeout('));
 assert.match(review,/if\(sensitiveUrl\(web\.getUrl\(\)\)\)\{call\.reject\("Reading unavailable on a sensitive or unverified page",SENSITIVE_PAGE\);return;\}/);
 assert.match(review,/if\(world==null\|\|!world\.ready\(\)\)\{call\.reject\(ISOLATED_MESSAGE,ISOLATED_WORLD_UNAVAILABLE\);return;\}/);
 assert.match(review,/rejected\.reject\("Reading unavailable on a sensitive or ambiguous page",SENSITIVE_PAGE\);/,'a page the extractor blocks is a sensitive refusal');
 assert.match(review,/if\(rejected!=null\)rejected\.reject\(ISOLATED_MESSAGE,ISOLATED_WORLD_UNAVAILABLE\);/,'an isolated world that fails to run is unavailable, not sensitive');
 // The sensitive check runs first: a sensitive page is never reported as merely unavailable.
 assert.ok(review.indexOf('SENSITIVE_PAGE')<review.indexOf('ISOLATED_WORLD_UNAVAILABLE'));
});
