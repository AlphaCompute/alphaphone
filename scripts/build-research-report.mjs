import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Concatenates REPORT.md and the numbered section files into FULL-REPORT.md. */
const dir = fileURLToPath(new URL('../docs/market-research/', import.meta.url));
const sections = readdirSync(dir).filter((name) => /^\d\d-.+\.md$/.test(name)).sort();
const parts = ['REPORT.md', ...sections].map((name) => readFileSync(join(dir, name), 'utf8').trim());
writeFileSync(join(dir, 'FULL-REPORT.md'), `${parts.join('\n\n---\n\n')}\n`);
console.log(`FULL-REPORT.md: ${parts.length} files`);
