#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
execFileSync(process.execPath,['scripts/prepare-local-agent.mjs','--source-only'],{cwd:root,stdio:'inherit'});
execFileSync(process.env.ALPHA_BUN||'bun',['--no-install','--conditions=eliza-source','test','./packages/agent/test/lean-chat-workflows.test.ts'],{
  cwd:resolve(root,'artifacts/local-agent-source'),stdio:'inherit',
});
