#!/usr/bin/env node
// Runs the real, unmodified Eliza app host with an isolated private profile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
const source = path.resolve(process.env.ALPHA_ELIZA_SOURCE || 'artifacts/local-agent-source');
const profile = path.resolve(process.env.ALPHA_REMOTE_PROFILE || path.join(os.homedir(), '.local/share/alphaphone/local-remote'));
const port = Number(process.env.ALPHA_REMOTE_PORT || 47839);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const keyPath = path.join(os.homedir(), '.config/alphaphone/cerebras-key');
let providerKey = process.env.CEREBRAS_API_KEY;
if (!providerKey && fs.existsSync(keyPath)) { if ((fs.statSync(keyPath).mode & 0o077) !== 0) throw new Error('Provider key must be owner-only'); providerKey=fs.readFileSync(keyPath,'utf8').trim(); }
if (!providerKey) throw new Error('Configure CEREBRAS_API_KEY or the private Cerebras key file.');
fs.mkdirSync(profile, {recursive:true, mode:0o700});
fs.chmodSync(profile, 0o700);
const tokenPath = path.join(profile, 'owner-token');
if (!fs.existsSync(tokenPath)) fs.writeFileSync(tokenPath, crypto.randomBytes(32).toString('hex'), {mode:0o600, flag:'wx'});
if ((fs.statSync(tokenPath).mode & 0o077) !== 0) throw new Error('Owner token must be owner-only');
const entry = path.join(source,'packages/app/src/runtime/dev-server.ts');
if (!fs.existsSync(entry)) throw new Error('Eliza app host source is missing');
const config = path.join(profile,'eliza.json');
if (!fs.existsSync(config)) fs.writeFileSync(config, JSON.stringify({cloud:{enabled:false}, serviceRouting:{llmText:{backend:'cerebras',transport:'direct',smallModel:'qwen-3.8-27b',largeModel:'qwen-3.8-27b'}},plugins:{entries:{'personal-assistant':{enabled:false}}}})+'\n', {mode:0o600, flag:'wx'});
const log = fs.openSync(path.join(profile,'server.log'), 'a', 0o600);
fs.fchmodSync(log, 0o600);
const baseEnv = Object.fromEntries(['PATH','TMPDIR','LANG','SHELL','USER','LOGNAME','HOME'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
const env = {...baseEnv, ELIZA_HEADLESS:'1', ELIZA_DISTRIBUTION_PROFILE:'store', ELIZA_PLUGIN_SET:'lean-chat', ELIZA_REQUIRE_LOCAL_AUTH:'1', ELIZA_API_BIND:'127.0.0.1', ELIZA_ALLOWED_HOSTS:'10.0.2.2', ELIZA_API_PORT:String(port), ELIZA_API_EXPOSE_PORT:'1', ELIZA_STATE_DIR:profile, ELIZA_CONFIG_PATH:config, ELIZA_API_TOKEN:fs.readFileSync(tokenPath,'utf8').trim(), CEREBRAS_API_KEY:providerKey, CEREBRAS_MODEL:'qwen-3.8-27b', CEREBRAS_SMALL_MODEL:'qwen-3.8-27b', CEREBRAS_LARGE_MODEL:'qwen-3.8-27b', ELIZAOS_CLOUD_USE_INFERENCE:'false'};
for (const key of ['ELIZAOS_CLOUD_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY']) delete env[key];
const child = spawn(process.env.ALPHA_BUN || 'bun', [entry], {cwd:profile, env, stdio:['ignore',log,log]});
const sourceManifest=path.join(source,'.alpha-runtime-source.json');
const metadata = {sourceManifestSha256:fs.existsSync(sourceManifest)?crypto.createHash('sha256').update(fs.readFileSync(sourceManifest)).digest('hex'):null,pid:child.pid, port, profile, source, revision:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(), startedAt:new Date().toISOString()};
fs.writeFileSync(path.join(profile,'process.json'), JSON.stringify(metadata,null,2), {mode:0o600});
console.log(JSON.stringify({...metadata, log:path.join(profile,'server.log')}));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
