import { prisma } from "../lib/prisma.js";
import {
  PublicationStatus,
  PlaylistVisibility,
} from "../generated/prisma/enums.js";
const trackSelect = {
  id: true,
  title: true,
  slug: true,
  trackNumber: true,
  discNumber: true,
  durationSeconds: true,
  artists: {
    where: { artist: { status: PublicationStatus.PUBLISHED } },
    select: {
      creditType: true,
      position: true,
      artist: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { position: "asc" },
  },
} as const;
const playlistSelect = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  tracks: {
    orderBy: { position: "asc" },
    where: {
      track: {
        status: PublicationStatus.PUBLISHED,
        album: {
          status: PublicationStatus.PUBLISHED,
          artist: { status: PublicationStatus.PUBLISHED },
        },
      },
    },
    select: { position: true, addedAt: true, track: { select: trackSelect } },
  },
} as const;
export const create = (
  ownerId: string,
  input: { name: string; description?: string; visibility: PlaylistVisibility },
) =>
  prisma.playlist.create({
    data: { ...input, ownerId },
    select: playlistSelect,
  });
export async function list(ownerId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.playlist.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.playlist.count({ where: { ownerId } }),
  ]);
  return { items, total };
}
export const get = (id: string, userId: string) =>
  prisma.playlist.findFirst({
    where: {
      id,
      OR: [
        { ownerId: userId },
        {
          visibility: {
            in: [PlaylistVisibility.PUBLIC, PlaylistVisibility.UNLISTED],
          },
        },
      ],
    },
    select: playlistSelect,
  });
export const update = (
  id: string,
  ownerId: string,
  data: {
    name?: string;
    description?: string;
    visibility?: PlaylistVisibility;
  },
) => prisma.playlist.updateMany({ where: { id, ownerId }, data });
export const remove = (id: string, ownerId: string) =>
  prisma.playlist.deleteMany({ where: { id, ownerId } });
export async function add(id: string, ownerId: string, trackId: string) {
  return prisma.$transaction(async (tx) => {
    const playlist = await tx.playlist.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!playlist) return "missing" as const;
    const track = await tx.track.findFirst({
      where: {
        id: trackId,
        status: PublicationStatus.PUBLISHED,
        album: {
          status: PublicationStatus.PUBLISHED,
          artist: { status: PublicationStatus.PUBLISHED },
        },
        artists: { some: { artist: { status: PublicationStatus.PUBLISHED } } },
      },
      select: { id: true },
    });
    if (!track) return "track" as const;
    const exists = await tx.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId: id, trackId } },
    });
    if (exists) return "duplicate" as const;
    const last = await tx.playlistTrack.findFirst({
      where: { playlistId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await tx.playlistTrack.create({
      data: { playlistId: id, trackId, position: (last?.position ?? -1) + 1 },
    });
    return "ok" as const;
  });
}
export async function removeTrack(
  id: string,
  ownerId: string,
  trackId: string,
) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.playlist.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!p) return "missing" as const;
    const row = await tx.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId: id, trackId } },
      select: { position: true },
    });
    if (!row) return "missing" as const;
    await tx.playlistTrack.delete({
      where: { playlistId_trackId: { playlistId: id, trackId } },
    });
    await tx.playlistTrack.updateMany({
      where: { playlistId: id, position: { gt: row.position } },
      data: { position: { decrement: 1 } },
    });
    return "ok" as const;
  });
}
export async function reorder(id: string, ownerId: string, ids: string[]) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.playlist.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!p) return "missing" as const;
    const rows = await tx.playlistTrack.findMany({
      where: { playlistId: id },
      select: { trackId: true },
    });
    if (
      rows.length !== ids.length ||
      rows.some((r) => !ids.includes(r.trackId))
    )
      return "mismatch" as const;
    await tx.playlistTrack.updateMany({
      where: { playlistId: id },
      data: { position: { increment: ids.length + 1 } },
    });
    for (const [position, trackId] of ids.entries())
      await tx.playlistTrack.update({
        where: { playlistId_trackId: { playlistId: id, trackId } },
        data: { position },
      });
    return "ok" as const;
  });
}
