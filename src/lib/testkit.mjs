// ---------------------------------------------------------------------------
// The harness the tests share: bundle a TypeScript module and import it, and
// report checks in a form that names what failed rather than which assertion
// number it was.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '../../node_modules/.cache/academic');

export async function load(relativePath) {
  mkdirSync(cache, { recursive: true });
  const out = join(cache, relativePath.replace(/[^a-z0-9]/gi, '_') + '.mjs');
  execFileSync('npx', [
    'esbuild', join(here, relativePath), '--bundle', '--format=esm',
    '--platform=node', `--outfile=${out}`, '--log-level=error',
    '--packages=external', `--alias:@=${join(here, '..')}`,
  ]);
  return import(out + `?t=${Date.now()}`);
}

export function suite(title) {
  let failures = 0;
  console.log(`\n${title}\n`);
  const api = {
    check(label, actual, expected) {
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok    ${label}`);
      } else {
        failures++;
        console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
      }
    },
    section(name) { console.log(`\n${name}\n`); },
    async refuses(label, run) {
      try {
        await run();
        failures++;
        console.error(`FAIL  ${label}\n      it was allowed`);
      } catch (error) {
        console.log(`ok    ${label} — “${error.message}”`);
      }
    },
    done() {
      console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
      process.exit(failures ? 1 : 0);
    },
  };
  return api;
}
