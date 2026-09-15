// ---------------------------------------------------------------------------
// THE NUMBERS ON docs/BUILT.md ARE COUNTED, AND THIS IS WHAT COUNTS THEM.
//
// An audit written once is accurate once. The figures in that document — how
// many screens, how many refusals, how many languages — are exactly the kind
// of claim that is true on the day it is written and quietly false a month
// later, and a customer reading a stale number is being misled whether or not
// anybody meant to.
//
// So the document is held to the repository rather than to somebody's memory.
// Add a screen without updating the page and this fails.
//
// It lives in `scripts/` rather than among the suites for a plain reason: it
// runs `npm test` to count the checks, and a suite that runs the suite it is
// part of does not terminate. `npm run check:built`, beside `npm run check:rtl`.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { suite } from '../src/lib/testkit.mjs';

const root = join(import.meta.dirname, '..');
const page = readFileSync(join(root, 'docs/BUILT.md'), 'utf8');
const t = suite('The audit counts what is actually here');

/** The number BUILT.md gives for a row, read out of its table. */
function claimed(label) {
  const row = page.split('\n').find((line) => line.includes(label));
  if (!row) return null;
  const match = row.match(/\*\*([\d,]+)\*\*/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function walk(dir, test, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, test, found);
    else if (test(path)) found.push(path);
  }
  return found;
}

t.section('What the repository contains');

const screens = walk(join(root, 'src/app'), (p) => p.endsWith('page.tsx')).length;
t.check('screens', screens, claimed('Screens'));

const routes = walk(join(root, 'src/app'), (p) => p.endsWith('route.ts')).length;
t.check('API routes', routes, claimed('API routes'));

const components = readdirSync(join(root, 'src/components')).filter((f) => f.endsWith('.tsx')).length;
t.check('components', components, claimed('React components'));

const tests = walk(join(root, 'src'), (p) => p.endsWith('.test.mjs'))
  .concat(walk(join(root, 'bench'), (p) => p.endsWith('.test.mjs'))).length;
t.check('test files', tests, claimed('Test files'));

t.section('What the rules say');

const sql = readFileSync(join(root, 'docs/integration/001_lecture_studio.sql'), 'utf8');
t.check('Postgres tables', (sql.match(/create table/g) ?? []).length, claimed('Postgres tables'));
t.check('…and policies',
  (sql.match(/create policy/g) ?? []).length,
  Number(page.match(/under \*\*(\d+)\*\* row-level-security policies/)[1]));

const ui = readFileSync(join(root, 'src/lib/i18n/ui.ts'), 'utf8');
const english = ui.split('const en: Record<UIKey, string> = {')[1].split('\n};')[0];
t.check('interface strings per language', (english.match(/^ {2}'/gm) ?? []).length, claimed('Interface strings per language'));

const languages = (ui.match(/^const [a-z]{2}: (?:Catalogue|Record<UIKey, string>)/gm) ?? []).length;
t.check('languages', languages, claimed('Languages the interface speaks'));

const cases = readFileSync(join(root, 'bench/cases.mjs'), 'utf8');
t.check('benchmark cases', (cases.match(/^\s+id: '/gm) ?? []).length, claimed('Preservation-benchmark cases'));

t.section('And the number that matters most');

// A REFUSAL IS A RULE SOMEBODY HAS WATCHED TURN SOMETHING DOWN. This is the
// figure the page says to read, so it is the figure most worth holding.
const refusals = walk(join(root, 'src'), (p) => p.endsWith('.test.mjs'))
  .concat(walk(join(root, 'bench'), (p) => p.endsWith('.test.mjs')))
  .reduce((total, file) => total + (readFileSync(file, 'utf8').match(/t\.refuses\(/g) ?? []).length, 0);
t.check('refusals watched', refusals, claimed('a rule watched turning something down'));

// The total is checked last because it is the slowest: it runs the suite.
t.section('And the total, by running it');

const all = execFileSync('npm', ['test'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const passed = (all.match(/^ok/gm) ?? []).length;
t.check('checks that must pass', passed, claimed('Checks that must pass'));

t.done();
