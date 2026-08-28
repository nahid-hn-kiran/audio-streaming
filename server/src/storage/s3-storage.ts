import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import type { ObjectHead, ObjectStorage } from "./object-storage.js";
const client = new S3Client({ region: env.OBJECT_STORAGE_REGION, endpoint: env.OBJECT_STORAGE_ENDPOINT, credentials: env.OBJECT_STORAGE_ACCESS_KEY_ID && env.OBJECT_STORAGE_SECRET_ACCESS_KEY ? { accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY } : undefined });
export const storage: ObjectStorage = {
  async createUploadUrl(key, contentType, expiresIn) { return getSignedUrl(client, new PutObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key, ContentType: contentType }), { expiresIn }); },
  async headObject(key): Promise<ObjectHead | null> { try { const r = await client.send(new HeadObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key })); return { contentLength: r.ContentLength, contentType: r.ContentType, checksum: r.ChecksumSHA256 ?? r.ETag }; } catch (error) { console.error("Object storage HeadObject failed", { error: error instanceof Error ? error.name : "UnknownError", code: typeof error === "object" && error !== null && "$metadata" in error ? (error as { name?: string }).name : undefined, bucket: env.OBJECT_STORAGE_BUCKET, key }); return null; } },
  async createDownloadUrl(key, expiresIn) { return getSignedUrl(client, new GetObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key }), { expiresIn }); },
  async deleteObject(key) { await client.send(new DeleteObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key })); },
};
