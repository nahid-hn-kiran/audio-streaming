-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('INITIATED', 'UPLOADING', 'UPLOADED', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "mediaAssetId" UUID,
    "provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "expectedMimeType" TEXT NOT NULL,
    "expectedByteSize" BIGINT NOT NULL,
    "checksum" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'INITIATED',
    "failureCode" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upload_trackId_status_idx" ON "Upload"("trackId", "status");

-- CreateIndex
CREATE INDEX "Upload_status_expiresAt_idx" ON "Upload"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
