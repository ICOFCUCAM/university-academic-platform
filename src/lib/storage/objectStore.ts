// ---------------------------------------------------------------------------
// AN OBJECT STORE, BEHIND THE SAME THREE METHODS.
//
// Disk is right for one university on one server. It is wrong for anybody
// running two instances, and wrong for a business: the second instance cannot
// read what the first one wrote.
//
// This speaks S3's HTTP API, which is what AWS S3, Cloudflare R2, MinIO,
// Backblaze B2 and Supabase Storage's S3 endpoint all speak. One endpoint, one
// bucket, one pair of credentials — and no SDK: the signature is forty lines of
// HMAC and the dependency would be forty megabytes.
//
// WHAT IS NOT CLAIMED. This has never run against a real bucket. It is proved
// against a fake server that checks the request it receives — the method, the
// path, the payload hash, and that the Authorization header signs exactly the
// headers it says it signs — which is enough to catch a signature that is
// wrong in shape and not enough to promise it authenticates. Until somebody
// points it at a bucket, `docs/GAPS.md` says so.
//
// THE KEYS ARE STILL OURS. A filename from a browser never reaches the path;
// see storage.ts, which this deliberately mirrors rather than re-deciding.
// ---------------------------------------------------------------------------

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { ACCEPTED, Unsupported, type Storage, type StoredFile } from './storage';

export interface ObjectStoreOptions {
  /** e.g. https://s3.eu-west-2.amazonaws.com, or an R2 / MinIO / Supabase host. */
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Path style puts the bucket in the path rather than the hostname. MinIO and
   * Supabase need it; AWS accepts it. Default true, because the failure mode of
   * the wrong choice is a DNS error nobody can read.
   */
  pathStyle?: boolean;
  /** Injectable so the test can watch what is actually sent. */
  fetch?: typeof globalThis.fetch;
}

const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** Percent-encode a key the way S3 expects: every segment, slashes kept. */
function encodeKey(key: string): string {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

/**
 * AWS Signature Version 4, for one request with no query string.
 *
 * The parts that are easy to get wrong and are therefore written out rather
 * than folded together: the signed headers must be sorted, lower-cased, and
 * exactly the headers listed in `SignedHeaders`; the payload hash goes in the
 * canonical request AND in `x-amz-content-sha256`; and the date is basic
 * ISO-8601 with no punctuation.
 */
function sign(options: {
  method: string; host: string; path: string; body: Buffer | '';
  headers: Record<string, string>; region: string; accessKeyId: string; secretAccessKey: string;
  at?: Date;
}): Record<string, string> {
  const at = options.at ?? new Date();
  const stamp = at.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const payloadHash = hash(options.body === '' ? '' : options.body);

  const headers: Record<string, string> = {
    ...options.headers,
    host: options.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  };

  const names = Object.keys(headers).map((n) => n.toLowerCase()).sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${String(headers[Object.keys(headers).find((k) => k.toLowerCase() === name)!]).trim()}\n`)
    .join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    options.method, options.path, '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const scope = `${day}/${options.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, hash(canonicalRequest)].join('\n');

  const signature = createHmac('sha256',
    hmac(hmac(hmac(hmac(`AWS4${options.secretAccessKey}`, day), options.region), 's3'), 'aws4_request'))
    .update(toSign).digest('hex');

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${scope}, `
      + `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function createObjectStorage(options: ObjectStoreOptions): Storage {
  const call = options.fetch ?? globalThis.fetch;
  const endpoint = new URL(options.endpoint);
  const pathStyle = options.pathStyle ?? true;

  const where = (key: string) => {
    const encoded = encodeKey(key);
    return pathStyle
      ? { host: endpoint.host, path: `/${options.bucket}/${encoded}` }
      : { host: `${options.bucket}.${endpoint.host}`, path: `/${encoded}` };
  };

  const request = async (method: string, key: string, body: Buffer | '', contentType?: string) => {
    const { host, path } = where(key);
    const headers = sign({
      method, host, path, body,
      headers: contentType ? { 'content-type': contentType } : {},
      region: options.region,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    });
    return call(`${endpoint.protocol}//${host}${path}`, {
      method,
      headers,
      body: body === '' ? undefined : new Uint8Array(body),
    });
  };

  return {
    id: 'object',

    async put({ courseId, lectureId, kind, originalName, contentType, data }): Promise<StoredFile> {
      const extension = ACCEPTED[contentType];
      if (!extension) {
        throw new Unsupported(
          `${contentType || 'that file'} is not a lecture recording this platform accepts. ` +
          'MP3, M4A, WAV, AAC, OGG, WebM, MP4 and MOV are.',
        );
      }

      const key = `${courseId}/${lectureId}/${kind}-${randomUUID()}.${extension}`;
      const response = await request('PUT', key, data, contentType);
      if (!response.ok) {
        // WHAT THE STORE SAID, NOT WHAT WE GUESS IT MEANT. A bucket refusing a
        // key for a reason of its own should not be reported as "upload failed".
        throw new Unsupported(
          `The object store refused this recording (${response.status}): ${(await response.text()).slice(0, 300)}`,
        );
      }

      return {
        key,
        originalName,
        contentType,
        bytes: data.byteLength,
        sha256: createHash('sha256').update(data).digest('hex'),
        at: new Date().toISOString(),
      };
    },

    async get(key) {
      const response = await request('GET', key, '');
      if (!response.ok) return null;
      return {
        data: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type')
          ?? Object.entries(ACCEPTED).find(([, ext]) => ext === key.split('.').pop())?.[0]
          ?? 'application/octet-stream',
      };
    },

    async remove(key) {
      await request('DELETE', key, '');
    },
  };
}

/** The signer, exported so a test can read a request rather than trust it. */
export const __signForTests = sign;
