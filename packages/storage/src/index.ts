import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Object storage for PHI documents (lab reports, imaging, signed forms, generated
 * claim PDFs). Talks to any S3-compatible endpoint — MinIO locally, real S3/R2/etc in
 * production — configured entirely through env vars, never a name baked into the code.
 *
 * Callers never construct a public URL themselves: every read goes through a
 * short-lived signed URL, and every write returns only the opaque storage key that
 * `documents.storageKey` persists. The bucket never needs public access.
 */

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Object storage is not configured — set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
  }
  cachedClient = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

function bucketOrThrow(bucket?: string): string {
  const b = bucket ?? process.env.S3_BUCKET;
  if (!b) throw new Error('Object storage is not configured — set S3_BUCKET.');
  return b;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  bucket?: string;
}

export async function putObject(input: PutObjectInput): Promise<{ bucket: string; key: string }> {
  const bucket = bucketOrThrow(input.bucket);
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
  return { bucket, key: input.key };
}

export interface SignedDownloadUrlInput {
  key: string;
  bucket?: string;
  /** Forces a download with this filename instead of an inline view. */
  downloadFilename?: string;
  /** Default 5 minutes — PHI links should not stay valid indefinitely. */
  expiresInSeconds?: number;
}

export async function getSignedDownloadUrl(input: SignedDownloadUrlInput): Promise<string> {
  const bucket = bucketOrThrow(input.bucket);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ResponseContentDisposition: input.downloadFilename ? `attachment; filename="${input.downloadFilename.replace(/"/g, '')}"` : undefined,
  });
  return getSignedUrl(client(), command, { expiresIn: input.expiresInSeconds ?? 300 });
}

export async function deleteObject(key: string, bucket?: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucketOrThrow(bucket), Key: key }));
}
