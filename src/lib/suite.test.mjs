// ---------------------------------------------------------------------------
// A TEST NOBODY RUNS IS NOT A TEST.
//
// Three suites were written, passed when run by hand, and then sat outside
// `npm test` where nothing would have noticed them going red — which is worse
// than not having written them, because the repository looks tested.
//
// So the runner is checked against the filesystem: every `*.test.mjs` has to
// be reachable from `npm test`, and adding one without adding it to the suite
// fails here.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { suite } from './testkit.mjs';

const root = join(import.meta.dirname, '../..');
const t = suite('Every suite is in the suite');

const found = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.test.mjs')) found.push(relative(root, path));
  }
}
walk(join(root, 'src'));
walk(join(root, 'bench'));

const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
const all = scripts.test;
const reachable = new Set();
for (const [name, command] of Object.entries(scripts)) {
  if (name === 'test' || !all.includes(`npm run ${name}`)) continue;
  const match = command.match(/node\s+(\S+\.test\.mjs)/);
  if (match) reachable.add(match[1]);
}

t.check('every test file found on disk is run by `npm test`',
  found.filter((file) => !reachable.has(file)), []);
t.check('and every test `npm test` runs is a file that exists',
  [...reachable].filter((file) => !found.includes(file)), []);
t.check('there is more than one of them', found.length > 20, true);

t.done();
