import { prisma } from "../lib/prisma.js";
import { UploadStatus } from "../generated/prisma/enums.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { env } from "../config/env.js";
import { storage } from "../storage/s3-storage.js";
export async function cleanupUploads(store: ObjectStorage = storage) {
  const cutoff = new Date(Date.now() - env.UPLOAD_CLEANUP_GRACE_SECONDS * 1000);
  const uploads = await prisma.upload.findMany({
    where: {
      status: { in: [UploadStatus.FAILED, UploadStatus.EXPIRED] },
      updatedAt: { lt: cutoff },
      mediaAssetId: null,
    },
    select: { id: true, objectKey: true },
  });
  let cleaned = 0;
  for (const upload of uploads) {
    if (
      !upload.objectKey.startsWith("tracks/") ||
      !upload.objectKey.includes(`/uploads/${upload.id}/`)
    )
      continue;
    try {
      await store.deleteObject(upload.objectKey);
      await prisma.upload.update({
        where: { id: upload.id },
        data: { failureCode: "CLEANED" },
      });
      cleaned++;
    } catch (error) {
      console.error("Upload cleanup failed", {
        error: error instanceof Error ? error.name : "UnknownError",
        uploadId: upload.id,
      });
    }
  }
  return cleaned;
}
