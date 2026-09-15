// ---------------------------------------------------------------------------
// WHERE THE RECORDING ACTUALLY LIVES.
//
// The upload form recorded a file NAME for months and stored nothing, which is
// the worst kind of gap: it looks like it worked. These checks are about the
// two things that make storage safe rather than merely present — the platform
// controls the path, and it refuses what it cannot keep.
// ---------------------------------------------------------------------------

import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, suite } from '../testkit.mjs';

const S = await load('storage/storage.ts');
const t = suite('Storage');

const root = mkdtempSync(join(tmpdir(), 'academic-'));
const store = S.createDiskStorage(root);
const data = Buffer.from('not really an mp3, but bytes are bytes');

t.section('A recording is kept, under a key the platform minted');
const stored = await store.put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: 'Lecture 06 FINAL (2).mp3', contentType: 'audio/mpeg', data,
});
t.check('the key is built from ids, not from the name',
  /^c1\/l1\/recording-[0-9a-f-]+\.mp3$/.test(stored.key), true);
t.check('…and the name is kept as a label', stored.originalName, 'Lecture 06 FINAL (2).mp3');
t.check('…with the size', stored.bytes, data.byteLength);
t.check('…and a digest, so the same lecture twice is knowable', stored.sha256.length, 64);
t.check('it is on disk', existsSync(join(root, stored.key)), true);

const back = await store.get(stored.key);
t.check('and it comes back', back.data.toString(), data.toString());
t.check('…with its type', back.contentType, 'audio/mpeg');

t.section('A filename from a browser is attacker-controlled input');
// "../../etc/passwd.mp3" is a valid filename on several systems. The key is
// built from ids we minted, so the name cannot reach the path at all.
const nasty = await store.put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: '../../../etc/passwd.mp3', contentType: 'audio/mpeg', data,
});
t.check('the traversal is not in the key', nasty.key.includes('..'), false);
t.check('…and the file landed inside the store', existsSync(join(root, nasty.key)), true);
t.check('reading outside the store returns nothing',
  await store.get('../../../etc/passwd'), null);

t.section('Re-uploading does not overwrite what somebody is listening to');
const again = await store.put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: 'same.mp3', contentType: 'audio/mpeg', data,
});
t.check('a second upload has its own key', again.key === stored.key, false);
t.check('…and the first is still there', !!(await store.get(stored.key)), true);

t.section('And what it will not take, it refuses by name');
await t.refuses('a PDF is not a lecture recording', () => store.put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: 'notes.pdf', contentType: 'application/pdf', data,
}));
for (const type of ['audio/mpeg', 'audio/x-m4a', 'audio/wav', 'video/mp4', 'audio/webm']) {
  t.check(`${type} is accepted`, !!S.ACCEPTED[type], true);
}

t.section('With nothing configured, it says so rather than dropping the file');
await t.refuses('the empty store refuses', () => S.noStorage().put({
  courseId: 'c1', lectureId: 'l1', kind: 'recording',
  originalName: 'x.mp3', contentType: 'audio/mpeg', data,
}));

t.done();
