// ---------------------------------------------------------------------------
// WHERE THE RECORDING ACTUALLY LIVES.
//
// The upload form recorded a file NAME for months: a lecturer chose their
// ninety-minute recording, the platform wrote down what it was called, and
// nothing was stored. That is the worst kind of gap — it looks like it worked.
//
// Two implementations behind one interface:
//
//   DISK        a directory on the machine. Real, works today, and is what a
//               single-server installation actually wants: a university that
//               will not let lecture audio leave its estate is a university
//               that will not let it leave its estate.
//   OBJECT      objectStore.ts — S3's HTTP API, which AWS, R2, MinIO, B2 and
//               Supabase Storage all speak. What anybody running two instances
//               needs, because the second cannot read what the first wrote to
//               its own disk.
//
// AND THE PATHS ARE OURS, NOT THE USER'S. A filename from a browser is
// attacker-controlled input — `../../etc/passwd.mp3` is a valid filename on
// several operating systems — so the stored path is built from ids we minted
// and the original name is kept only as a label.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createObjectStorage } from './objectStore';

export interface StoredFile {
  /** The key the platform uses. Never a name a person typed. */
  key: string;
  /** What it was called when it was chosen, for showing back to them. */
  originalName: string;
  contentType: string;
  bytes: number;
  /** For working out whether the same lecture was uploaded twice. */
  sha256: string;
  at: string;
}

export interface Storage {
  readonly id: 'disk' | 'object' | 'none';
  put(input: {
    courseId: string; lectureId: string; kind: 'recording' | 'audio';
    originalName: string; contentType: string; data: Buffer;
  }): Promise<StoredFile>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  remove(key: string): Promise<void>;
}

/** What a lecture may arrive as. Anything else is refused by name. */
export const ACCEPTED: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export class Unsupported extends Error {}

export function createDiskStorage(root: string): Storage {
  const base = resolve(root);

  return {
    id: 'disk',

    async put({ courseId, lectureId, kind, originalName, contentType, data }) {
      const extension = ACCEPTED[contentType];
      if (!extension) {
        throw new Unsupported(
          `${contentType || 'that file'} is not a lecture recording this platform accepts. ` +
          'MP3, M4A, WAV, AAC, OGG, WebM, MP4 and MOV are.',
        );
      }

      // THE KEY IS OURS. Ids we minted, and one segment of randomness so that
      // re-uploading does not overwrite the recording somebody is listening to.
      const key = `${courseId}/${lectureId}/${kind}-${randomUUID()}.${extension}`;
      const path = join(base, key);
      // Refuse anything that escapes the root, whatever produced the key.
      if (!resolve(path).startsWith(base)) throw new Unsupported('That path is not inside the store.');

      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, data);

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
      const path = join(base, key);
      if (!resolve(path).startsWith(base) || !existsSync(path)) return null;
      const extension = key.split('.').pop() ?? '';
      const contentType = Object.entries(ACCEPTED)
        .find(([, ext]) => ext === extension)?.[0] ?? 'application/octet-stream';
      return { data: readFileSync(path), contentType };
    },

    async remove(key) {
      const path = join(base, key);
      if (resolve(path).startsWith(base) && existsSync(path)) unlinkSync(path);
    },
  };
}

/**
 * What runs when nothing is configured. It refuses BY NAME rather than
 * accepting a file and dropping it — the failure this whole module exists to
 * correct.
 */
export function noStorage(): Storage {
  const refuse = () => {
    throw new Unsupported(
      'No file storage is configured, so a recording cannot be kept. Set ACADEMIC_MEDIA_DIR, ' +
      'or paste the transcript in — the rest of the pipeline runs from there.',
    );
  };
  return {
    id: 'none',
    async put() { return refuse(); },
    async get() { return null; },
    async remove() { /* nothing was stored */ },
  };
}

export function storage(): Storage {
  // THE OBJECT STORE WINS WHERE IT IS CONFIGURED, and it is configured only
  // when every part of it is: a bucket with no credentials is a deployment
  // that would fail on the first upload rather than on the first page.
  const { ACADEMIC_S3_ENDPOINT, ACADEMIC_S3_BUCKET, ACADEMIC_S3_KEY_ID, ACADEMIC_S3_SECRET } = process.env;
  if (ACADEMIC_S3_ENDPOINT && ACADEMIC_S3_BUCKET && ACADEMIC_S3_KEY_ID && ACADEMIC_S3_SECRET) {
    return createObjectStorage({
      endpoint: ACADEMIC_S3_ENDPOINT,
      bucket: ACADEMIC_S3_BUCKET,
      region: process.env.ACADEMIC_S3_REGION ?? 'us-east-1',
      accessKeyId: ACADEMIC_S3_KEY_ID,
      secretAccessKey: ACADEMIC_S3_SECRET,
      pathStyle: process.env.ACADEMIC_S3_PATH_STYLE !== 'false',
    });
  }

  const dir = process.env.ACADEMIC_MEDIA_DIR;
  if (!dir) return noStorage();
  mkdirSync(dir, { recursive: true });
  return createDiskStorage(dir);
}
