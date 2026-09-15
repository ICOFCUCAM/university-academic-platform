// ---------------------------------------------------------------------------
// WHAT IS ACTUALLY SENT TO THE BUCKET.
//
// There is no bucket here, so this reads the request rather than trusting it:
// the method, the path, the payload hash, and — the part worth checking —
// that the Authorization header signs exactly the headers it claims to sign,
// in the order S3 requires. A signature that is wrong in shape fails with a
// 403 nobody can read, and the message it produces would be "upload failed".
//
// It also pins the signature against a KNOWN VECTOR: AWS's own published
// example. A signer that produces a self-consistent wrong answer passes every
// test written against itself, which is why one of these is not written
// against itself.
// ---------------------------------------------------------------------------

import { load, suite } from '../testkit.mjs';

const O = await load('storage/objectStore.ts');
const t = suite('Talking to an object store');

t.section('The signature, against AWS’s own published example');

// From the AWS SigV4 test suite: GET / on examplebucket, empty payload, with
// the documented key, date and region. If this line changes, either the signer
// changed or somebody has quietly stopped following the specification.
const known = O.__signForTests({
  method: 'GET',
  host: 'examplebucket.s3.amazonaws.com',
  path: '/test.txt',
  body: '',
  headers: { range: 'bytes=0-9' },
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  at: new Date('2013-05-24T00:00:00Z'),
});
t.check('the signature matches the published one',
  known.authorization.split('Signature=')[1],
  'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
t.check('…and it signs the headers it says it signs',
  known.authorization.match(/SignedHeaders=([^,]+)/)[1],
  'host;range;x-amz-content-sha256;x-amz-date');
t.check('the empty payload is hashed, not omitted',
  known['x-amz-content-sha256'],
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

t.section('Putting a recording');

const sent = [];
const store = O.createObjectStorage({
  endpoint: 'https://s3.example.org',
  bucket: 'lectures',
  region: 'eu-west-2',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  fetch: async (url, init) => {
    sent.push({ url, method: init.method, headers: init.headers, bytes: init.body?.byteLength });
    return new Response('', { status: 200 });
  },
});

const stored = await store.put({
  courseId: 'course-biol101', lectureId: 'lecture-06', kind: 'recording',
  originalName: '../../etc/passwd.mp3', contentType: 'audio/mpeg',
  data: Buffer.from('not really audio'),
});

t.check('it is a PUT', sent[0].method, 'PUT');
t.check('…to the bucket, path style', sent[0].url.startsWith('https://s3.example.org/lectures/'), true);
// THE FILENAME NEVER REACHES THE PATH. The key is built from ids the platform
// minted; the name a browser supplied is kept as a label and nothing else.
t.check('the key is ours, not the name they typed',
  /^course-biol101\/lecture-06\/recording-[0-9a-f-]{36}\.mp3$/.test(stored.key), true);
t.check('…and the name is kept only as a label', stored.originalName, '../../etc/passwd.mp3');
t.check('…so nothing escapes the bucket', sent[0].url.includes('..'), false);
t.check('the bytes are what was handed in', sent[0].bytes, 16);
// The header must hash THIS body, not an empty one — the mistake that makes
// every upload of a non-empty file fail with a signature error.
t.check('the payload hash is this payload’s',
  sent[0].headers['x-amz-content-sha256'], stored.sha256);
t.check('…and not the hash of nothing',
  sent[0].headers['x-amz-content-sha256']
    === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', false);
t.check('the content type is signed too',
  sent[0].headers.authorization.includes('content-type'), true);

t.section('When the bucket refuses');

const refusing = O.createObjectStorage({
  endpoint: 'https://s3.example.org', bucket: 'lectures', region: 'eu-west-2',
  accessKeyId: 'key', secretAccessKey: 'secret',
  fetch: async () => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }),
});

// WHAT THE STORE SAID, not what we guessed it meant.
await t.refuses('the bucket’s own words come back', () => refusing.put({
  courseId: 'c', lectureId: 'l', kind: 'recording',
  originalName: 'x.mp3', contentType: 'audio/mpeg', data: Buffer.from('x'),
}));

const wrongKind = await (async () => {
  try {
    await store.put({
      courseId: 'c', lectureId: 'l', kind: 'recording',
      originalName: 'slides.pdf', contentType: 'application/pdf', data: Buffer.from('x'),
    });
    return 'allowed';
  } catch (error) { return error.message; }
})();
t.check('a PDF is refused by name before anything is sent',
  wrongKind.includes('is not a lecture recording this platform accepts'), true);

t.section('Reading one back');

const reading = O.createObjectStorage({
  endpoint: 'https://s3.example.org', bucket: 'lectures', region: 'eu-west-2',
  accessKeyId: 'key', secretAccessKey: 'secret',
  fetch: async (url, init) => (init.method === 'GET'
    ? new Response('audio bytes', { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    : new Response('', { status: 404 })),
});
const got = await reading.get('course/lecture/recording-1.mp3');
t.check('the bytes come back', got.data.toString(), 'audio bytes');
t.check('…with the type the store reported', got.contentType, 'audio/mpeg');

const missing = O.createObjectStorage({
  endpoint: 'https://s3.example.org', bucket: 'lectures', region: 'eu-west-2',
  accessKeyId: 'key', secretAccessKey: 'secret',
  fetch: async () => new Response('', { status: 404 }),
});
t.check('a key that is not there is null, not a crash',
  await missing.get('nothing'), null);

t.done();
