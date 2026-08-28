import { prisma } from "../lib/prisma.js";
import {
  PublicationStatus,
  MediaKind,
  MediaStatus,
} from "../generated/prisma/enums.js";
import { env } from "../config/env.js";
import type { ObjectStorage } from "../storage/object-storage.js";
export async function playback(id: string, store: ObjectStorage) {
  const track = await prisma.track.findFirst({
    where: {
      id,
      status: PublicationStatus.PUBLISHED,
      album: {
        status: PublicationStatus.PUBLISHED,
        artist: { status: PublicationStatus.PUBLISHED },
      },
      mediaAsset: { kind: MediaKind.AUDIO, status: MediaStatus.READY },
    },
    select: { mediaAsset: { select: { objectKey: true } } },
  });
  if (!track?.mediaAsset) return null;
  return {
    url: await store.createDownloadUrl(
      track.mediaAsset.objectKey,
      env.PLAYBACK_URL_TTL_SECONDS,
    ),
    expiresAt: new Date(
      Date.now() + env.PLAYBACK_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}
