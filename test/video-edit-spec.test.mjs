import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeSource,fixture,runJvm} from './fixtures/jvm-tools.mjs';

// Plain-JVM run of the pure video copy range rules. Not an APK, encoder, MediaStore or device check.
test('a video copy end within 0.05 s of the duration is the full video, on either side',()=>{
 assert.equal(runJvm([nativeSource('VideoEditSpec.java'),fixture('VideoEditSpecTest.java')],'ai.elizaresearch.alphaphone.VideoEditSpecTest').trim(),'PASS video edit spec');
});
