import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Tiny inventory fixture tests admission, never inference or device qualification.
export function stageNativeSpeech(root, commit) {
  const files = ['assets/paradee-voice/v1/manifest.json', 'assets/paradee-voice/v1/asr/model.gguf', ...['arm64-v8a','x86_64'].map(abi => `jniLibs/${abi}/libelizainference.so`)].map(name => {
    const bytes = Buffer.from(name), file = path.join(root,'artifacts/native-voice',name);
    fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,bytes);
    return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  fs.writeFileSync(path.join(root,'artifacts/native-voice/build-record.json'),JSON.stringify({sourceCommit:commit,abis:['arm64-v8a','x86_64'],files}));
}
