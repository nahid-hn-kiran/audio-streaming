import { prisma } from "../lib/prisma.js";
import { PublicationStatus } from "../generated/prisma/enums.js";
const track = {
  id: true,
  title: true,
  slug: true,
  trackNumber: true,
  discNumber: true,
  durationSeconds: true,
  album: {
    select: {
      id: true,
      title: true,
      slug: true,
      artist: { select: { id: true, name: true, slug: true } },
    },
  },
  artists: {
    where: { artist: { status: PublicationStatus.PUBLISHED } },
    orderBy: { position: "asc" },
    select: {
      creditType: true,
      position: true,
      artist: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;
const published = {
  status: PublicationStatus.PUBLISHED,
  album: {
    status: PublicationStatus.PUBLISHED,
    artist: { status: PublicationStatus.PUBLISHED },
  },
};
export async function like(userId: string, id: string) {
  const t = await prisma.track.findFirst({
    where: { id, ...published },
    select: { id: true },
  });
  if (!t) return "missing";
  try {
    await prisma.trackLike.create({ data: { userId, trackId: id } });
    return "ok";
  } catch (e) {
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    )
      return "duplicate";
    throw e;
  }
}
export async function unlike(userId: string, id: string) {
  const r = await prisma.trackLike.deleteMany({
    where: { userId, trackId: id },
  });
  return r.count ? "ok" : "missing";
}
export async function liked(userId: string, id: string) {
  return !!(await prisma.trackLike.findUnique({
    where: { userId_trackId: { userId, trackId: id } },
  }));
}
export async function likedTracks(userId: string, p: number, l: number) {
  const [rows, total] = await Promise.all([
    prisma.trackLike.findMany({
      where: { userId, track: { ...published } },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      select: { createdAt: true, track: { select: track } },
    }),
    prisma.trackLike.count({ where: { userId, track: { ...published } } }),
  ]);
  return { rows, total };
}
export async function history(
  userId: string,
  id: string,
  data: {
    progressSeconds?: number;
    completed: boolean;
    source?: "TRACK_PAGE" | "ALBUM" | "PLAYLIST" | "SEARCH" | "QUEUE";
  },
) {
  const t = await prisma.track.findFirst({
    where: { id, ...published },
    select: { id: true },
  });
  if (!t) return null;
  return prisma.listeningHistory.create({
    data: { userId, trackId: id, ...data },
    select: {
      id: true,
      trackId: true,
      playedAt: true,
      progressSeconds: true,
      completed: true,
      source: true,
    },
  });
}
export async function listHistory(userId: string, p: number, l: number) {
  const [rows, total] = await Promise.all([
    prisma.listeningHistory.findMany({
      where: { userId, track: { ...published } },
      orderBy: { playedAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      select: {
        id: true,
        playedAt: true,
        progressSeconds: true,
        completed: true,
        source: true,
        track: { select: track },
      },
    }),
    prisma.listeningHistory.count({
      where: { userId, track: { ...published } },
    }),
  ]);
  return { rows, total };
}
export async function deleteHistory(userId: string, id: string) {
  const r = await prisma.listeningHistory.deleteMany({ where: { id, userId } });
  return r.count > 0;
}
