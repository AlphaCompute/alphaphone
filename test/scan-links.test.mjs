import test from 'node:test';
import assert from 'node:assert/strict';
import {scannedLinks} from '../apps/app/src/prototype/scan-links.ts';

test('scan links preserve explicit destinations, normalize hosts and remove surrounding punctuation',()=>{
 assert.deepEqual(scannedLinks('See https://EXAMPLE.com/a?x=1&y=2#part and (www.example.org/test).\nhttps://example.com/hello(world)\nhttp://[::1]:8000/a'),['https://example.com/a?x=1&y=2#part','https://www.example.org/test','https://example.com/hello(world)','http://[::1]:8000/a']);
 assert.deepEqual(scannedLinks('https://example.com/ https://EXAMPLE.com'),['https://example.com/']);
 assert.deepEqual(scannedLinks('\"https://example.com/quote\"'),['https://example.com/quote']);
 assert.deepEqual(scannedLinks('https://例え.テスト/'),['https://xn--r8jz45g.xn--zckzah/']);
});
test('scan links never turn active schemes, credentials, malformed or ambiguous text into navigation',()=>{
 for(const text of ['javascript:alert(1)','javascript:https://example.com','file:///tmp/a','intent://example.com','data:text/html,https://example.com','https://user:secret@example.com','https://user%40example.com@evil.test','https://example.com\\@evil.test','https:///','https:///example.com','example.com','person@www.example.com','https://example.com/'+ 'a'.repeat(2050),'a'.repeat(100001)])assert.deepEqual(scannedLinks(text),[],text.slice(0,80));
});
test('scan link review limits and deduplicates results without joining broken OCR lines',()=>{
 assert.equal(scannedLinks(Array.from({length:20},(_,i)=>'https://example.com/'+i).join('\n')).length,10);
 assert.deepEqual(scannedLinks('https://exam\nple.com'),['https://exam/']);
 assert.deepEqual(scannedLinks('http://example.com/path,\n(http://example.com/path);'),['http://example.com/path']);
});
