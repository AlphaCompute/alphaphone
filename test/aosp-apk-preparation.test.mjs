import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('AOSP preparation preserves payloads and refuses signed or malformed input', () => {
  execFileSync('python3', ['test/aosp-apk-preparation.py'], {stdio:'pipe'});
});
