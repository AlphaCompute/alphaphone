#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {sourceDirectory} from './local-agent-source.mjs';
const root=resolve(import.meta.dirname,'..');
execFileSync(process.execPath,['scripts/prepare-local-agent.mjs','--source-only'],{cwd:root,stdio:'inherit'});
execFileSync(process.env.ALPHA_BUN||'bun',['--no-install','--conditions=eliza-source','test','./packages/agent/test/lean-chat-workflows.test.ts','./plugins/plugin-workflow/__tests__/hosted-route-registration.test.ts','./plugins/plugin-workflow/__tests__/smithers-process.test.ts','./plugins/plugin-workflow/__tests__/smithers-packaged-worker.test.ts','./plugins/plugin-workflow/__tests__/workflow-packaged-compiler.test.ts'],{
  cwd:sourceDirectory(root),stdio:'inherit',
});
