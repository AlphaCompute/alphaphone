import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseSync } from 'rolldown/utils';

// Ownership recommendations, not authorization to copy product UI upstream.
function ownership(file) {
  const name = path.basename(file);
  if (!file.startsWith('src/')) return { owner: 'alphaphone', disposition: 'retain', reason: 'Product entry HTML, visual assets, fonts, attribution, or public bootstrap.' };
  if (/\.(css|html|json|md)$/.test(file) || ['main.tsx', 'model.js', 'model.d.ts', 'dc-lite.js', 'mvp-features.ts', 'mock-attention.ts', 'dev-profile.ts', 'apps.ts', 'device-view-profile.ts', 'development-view-contract.ts'].includes(name)) return { owner: 'alphaphone', disposition: 'retain-or-split', reason: 'Product composition, design reference, enabled views, fixtures, or visual presentation. Extract embedded domain behavior separately.' };
  if (file.startsWith('src/maps/') || name === 'maps-contract.ts') return { owner: 'plugins/plugin-maps', disposition: 'extract-or-configure', reason: 'Maps domain; inject storage key, location, speech, regional transport and visual tokens. Alpha owns layout and provider defaults.' };
  if (/^(files|file-|selected-document|inbox-attachment|scan-|local-ocr)/.test(name) || name === 'content-question.ts') return { owner: 'plugins/plugin-files', disposition: 'extract-or-split', reason: 'File capabilities, document processing and reviewed selections; keep product dialogs and calendar handoff composition local.' };
  if (/calendar/.test(name)) return { owner: 'plugins/plugin-calendar + plugins/plugin-native-calendar', disposition: 'extract-or-split', reason: 'Calendar records, recurrence, approvals and browser provider; inject storage, review UI and native bridge.' };
  if (/reminder/.test(name)) return { owner: 'plugins/plugin-native-reminders', disposition: 'extract-or-split', reason: 'Reminder contracts, recurrence and durable reconciliation; retain Alpha editor bindings.' };
  if (/^(notes-|note-|browser-note)/.test(name)) return { owner: 'plugins/plugin-notes', disposition: 'extract-or-split', reason: 'Notes and audio metadata persistence; inject legacy keys, secure store, clock and approval contracts.' };
  if (/camera|photo|video/.test(name)) return { owner: 'plugins/plugin-native-camera', disposition: 'extract-or-split', reason: 'Capture, media processing and library behavior; keep Alpha viewfinder, filter presets and review layouts local.' };
  if (/^(workflow-|simulated-workflows|development-workflows|phone-workflow)/.test(name)) return { owner: 'plugins/plugin-workflow', disposition: 'extract-or-split', reason: 'Workflow contracts, execution and simulation; preserve review, identity and no-replay semantics; inject product view policy.' };
  if (/digest|hosted-|delegation/.test(name)) return { owner: 'plugins/plugin-personal-assistant + packages/ui client integration', disposition: 'extract-or-split', reason: 'Digest protocols, source selection and result delivery; keep product-specific panels and local composition.' };
  if (/voice|speech|audio|recording|transcript/.test(name)) return { owner: 'plugins/plugin-native-talkmode', disposition: 'extract-or-split', reason: 'Owned audio capture/playback and speech transport; inject review surfaces, account binding and product language/recording policy.' };
  if (/browser-|reading-|password-provider/.test(name)) return { owner: 'plugins/plugin-native-browser-surface + plugins/plugin-browser', disposition: 'extract-or-split', reason: 'Isolated browser observation/navigation and reading; inject lifecycle, consent UI, vault provider and styling.' };
  if (/inbox|mail/.test(name)) return { owner: 'plugins/plugin-personal-assistant + cloud client', disposition: 'extract-or-split', reason: 'Inbox drafts, exact attachment context and operation fencing; keep Alpha inbox presentation.' };
  if (/clock/.test(name)) return { owner: 'existing upstream clock/device execution surface', disposition: 'extract-or-split', reason: 'Clock observation and reviewed execution; reuse existing clock patch instead of inventing a second executor.' };
  if (/location/.test(name)) return { owner: 'plugins/plugin-native-location', disposition: 'extract-or-split', reason: 'Real and simulated location providers; inject lifecycle, permission review and simulation state.' };
  if (/notification/.test(name)) return { owner: 'plugins/plugin-native-system', disposition: 'extract-or-split', reason: 'Notification queues and lifecycle; inject routing, device state and product presentation.' };
  if (/^(simulated-|simulator-|incoming-simulation|development-)/.test(name)) return { owner: 'shared client development harness', disposition: 'extract-or-split', reason: 'Explicit simulation only; separate reusable providers/state from Alpha sample data and prototype method patches.' };
  if (/^(alpha-client|cloud-|remote-|local-agent|device-actions|phone-context|native-connection|connection-ui)/.test(name)) return { owner: 'packages/ui client integration + existing agent/cloud transports', disposition: 'extract-or-split', reason: 'Authentication, protocol and approval machinery is generic; remove product view enums, bridge names, endpoints and singleton UI cycles first.' };
  return { owner: 'shared platform client; Alpha composition', disposition: 'split', reason: 'Cross-domain device/platform glue; separate host contracts and provider behavior from product registry, lifecycle, DOM and defaults.' };
}

// Usage: node scripts/audit-app-ownership.mjs [--check] [output.json]
// --check regenerates in memory and fails when the committed inventory is stale.
const args = process.argv.slice(2);
const check = args.includes('--check');
const unknown = args.filter(arg => arg.startsWith('-') && arg !== '--check');
if (unknown.length) { console.error(`Unknown option: ${unknown.join(' ')}`); process.exit(2); }
const output = args.find(arg => !arg.startsWith('-')) || 'docs/app-ownership-inventory.json';
const root = 'apps/app';
// Inventory tracked and untracked-but-not-ignored files, so local build output never enters it.
let admitted = null;
try {
  admitted = new Set(execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard', '--', root], { encoding: 'utf8' }).split('\0').filter(Boolean).map(file => path.posix.relative(root, file)));
} catch { admitted = null; }
const files = [];
function visit(directory) {
  // A fixed collation locale keeps --check independent of the machine's LANG/LC_ALL.
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name, 'en'))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { visit(full); continue; }
    const file = path.relative(root, full).split(path.sep).join('/');
    if (admitted && !admitted.has(file)) continue;
    const bytes = fs.readFileSync(full);
    const source = /\.(?:tsx?|js|css|html|json|md|svg)$/.test(file) ? bytes.toString('utf8') : null;
    const imports = new Set(), exports = new Set();
    if (source !== null && /\.(?:tsx?|js)$/.test(file)) {
      const parsed = parseSync(file, source);
      if (parsed.errors.length) throw Error(`Cannot inventory ${file}: ${JSON.stringify(parsed.errors)}`);
      function node(n) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(node); return; }
        if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(n.type) && typeof n.source?.value === 'string') imports.add(n.source.value);
        if (n.type === 'ExportNamedDeclaration') {
          if (n.declaration?.id?.name) exports.add(n.declaration.id.name);
          for (const d of n.declaration?.declarations || []) if(d.id?.name) exports.add(d.id.name);
          for (const specifier of n.specifiers || []) if(specifier.exported?.name) exports.add(specifier.exported.name);
        }
        for (const value of Object.values(n)) if (value && typeof value === 'object') node(value);
      }
      node(parsed.program);
    }
    const seams = [];
    if (source !== null) source.split('\n').forEach((line,index)=> {
      const tags = [];
      if (/alpha(?:phone|[-.:_ ]|Voice|Files|Device|Calendar|Maps|Browser|Notifications|Note|Mail)|Alpha Phone/.test(line)) tags.push('identity-or-compatibility');
      if (/localStorage|indexedDB|sessionStorage/.test(line)) tags.push('storage');
      if (/registerPlugin|connectionController|Component\.prototype|\.os['"]|alpha-back|device-state/.test(line)) tags.push('host-coupling');
      if (/#[a-fA-F0-9]{3,8}\b|font-family|--(?:bg|fg|accent)|style\.cssText/.test(line)) tags.push('presentation');
      if (tags.length) seams.push({ line: index+1, tags });
    });
    const upstreamCandidate = [...imports].filter(specifier => specifier.includes('.eliza/client-features/')).map(specifier => specifier.split('.eliza/client-features/')[1]);
    files.push({ file, upstreamCandidate, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), lines: source===null?null:source.split('\n').length, ...ownership(file), imports:[...imports].sort(), exports:[...exports].sort(), seams });
  }
}
visit(root);
const byFile = new Map(files.map(file=>[file.file,file]));
const reached = new Set();
function trace(file) {
  if (reached.has(file)) return;
  reached.add(file);
  for (const specifier of byFile.get(file)?.imports || []) {
    if (!specifier.startsWith('.')) continue;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier.split('?')[0]));
    const target = [relative,...['.ts','.tsx','.js','.css','.json','/index.ts'].map(extension=>relative+extension)].find(candidate=>byFile.has(candidate));
    if (target) trace(target);
  }
}
trace('src/main.tsx');
for (const file of files) if(file.file.startsWith('src/')) file.reachableFromMain = reached.has(file.file);
// A content digest instead of a commit hash keeps the inventory reproducible: it is
// fresh exactly when it describes the current apps/app bytes, whatever commit holds it.
const sourceDigest = createHash('sha256').update(files.map(file => `${file.file}\0${file.sha256}\n`).join('')).digest('hex');
const text = JSON.stringify({ schema:2, sourceDigest, scope:root, note:'Static ownership inventory. Seams are inspection pointers, not evidence of completed semantic review or migration. Legacy Alpha-prefixed storage/bridge/event names may be compatibility contracts.', files },null,2)+'\n';
if (check) {
  const current = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  if (current === text) { console.log(`${output} is current (${files.length} files)`); process.exit(0); }
  let previous = [];
  try { previous = JSON.parse(current).files || []; } catch {}
  const before = new Map(previous.map(file => [file.file, JSON.stringify(file)]));
  const after = new Map(files.map(file => [file.file, JSON.stringify(file)]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(file => before.get(file) !== after.get(file)).sort();
  console.error(`${output} is stale; ${changed.length} file entries differ${changed.length ? `: ${changed.slice(0, 20).join(', ')}${changed.length > 20 ? ', …' : ''}` : ' (header only)'}.`);
  console.error('Regenerate it with: node scripts/audit-app-ownership.mjs');
  process.exit(1);
}
fs.writeFileSync(output, text);
console.log(`${files.length} files inventoried in ${output}`);
