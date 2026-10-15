import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {JSDOM} from 'jsdom';
import {decodeMailPreview} from '../apps/app/src/runtime/mail-preview.ts';
const dom=new JSDOM('<!doctype html>');globalThis.document=dom.window.document;
after(()=>{dom.window.close();delete globalThis.document;});
test('Gmail preview decodes apostrophes, quotes, ampersands and Unicode references',()=>{
 assert.equal(decodeMailPreview('We&#39;ll confirm it&#x27;s ready &amp; say &quot;hello&quot;.'),'We\'ll confirm it\'s ready & say "hello".');
 assert.equal(decodeMailPreview('&apos;single&apos; &lsquo;smart&rsquo; &mdash; &#x1F680;'),'\'single\' ‘smart’ — 🚀');
 assert.equal(decodeMailPreview('A&nbsp;B &copy; 2026'),'A\u00a0B © 2026');
});
test('preview preserves literal text, unknown references and single-pass encoding',()=>{
 assert.equal(decodeMailPreview('Fish & chips <b>text</b> &unknown;'),'Fish & chips <b>text</b> &unknown;');
 assert.equal(decodeMailPreview('&amp;#39; &amp;amp;'),'&#39; &amp;');
 assert.equal(decodeMailPreview('https://example.test/?a=1&b=2'),'https://example.test/?a=1&b=2');
});
test('markup in preview text cannot create elements, scripts or image requests',()=>{
 assert.equal(decodeMailPreview('&lt;img src=&quot;https://example.test/pixel&quot; onerror=&quot;alert(1)&quot;&gt;'),'<img src="https://example.test/pixel" onerror="alert(1)">');
 assert.equal(document.querySelectorAll('img,script,iframe').length,0);
 assert.equal(document.body.childNodes.length,0);
});
