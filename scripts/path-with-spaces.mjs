// ---------------------------------------------------------------------------
// THE REPOSITORY RUNS FROM A PATH WITH A SPACE IN IT.
//
// Not a hypothetical. This platform is vendored into the University's own
// repository as a folder called "University academic platform", and the day it
// was first copied there, twenty-three checks failed: a test resolved its own
// directory with `new URL(...).pathname`, which percent-encodes, so every file
// it opened became one with %20 in the name and was reported missing.
//
// The suite passed in its own checkout and failed where it was actually going
// to live, which is the worst shape a test can have. So the suite is run from
// a directory whose name has a space in it, here, on demand:
//
//   npm run check:spaces
//
// It copies the committed tree into a temporary directory with a space in its
// name, links the installed dependencies rather than reinstalling them, and
// runs `npm test` there.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const base = mkdtempSync(join(tmpdir(), 'academic-'));
const where = join(base, 'University academic platform');

try {
  mkdirSync(where, { recursive: true });

  // The committed tree, exactly as it is vendored — not the working directory,
  // which may hold build output and local data.
  execFileSync('sh', ['-c',
    `git -C ${JSON.stringify(root)} archive HEAD | tar -x -C ${JSON.stringify(where)}`]);
  symlinkSync(join(root, 'node_modules'), join(where, 'node_modules'));

  console.log(`Running the suite from ${where}\n`);
  execFileSync('npm', ['test'], { cwd: where, stdio: 'inherit' });
  console.log('\nThe suite passes from a path with a space in it.\n');
} catch {
  console.error('\nThe suite FAILED from a path with a space in it.\n');
  process.exit(1);
} finally {
  rmSync(base, { recursive: true, force: true });
}
