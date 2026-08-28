import { prisma } from "../lib/prisma.js";
import { PublicationStatus } from "../generated/prisma/enums.js";

const published = { status: PublicationStatus.PUBLISHED } as const;

export async function listArtists(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.artist.findMany({
      where: published,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        bio: true,
        albums: {
          where: published,
          orderBy: { releaseDate: "desc" },
          select: { id: true, title: true, slug: true, releaseDate: true },
        },
      },
    }),
    prisma.artist.count({ where: published }),
  ]);
  return { items, total };
}

export function getArtist(slug: string) {
  return prisma.artist.findFirst({
    where: { slug, ...published },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      albums: {
        where: published,
        orderBy: { releaseDate: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          releaseDate: true,
        },
      },
    },
  });
}

export function getAlbum(slug: string) {
  return prisma.album.findFirst({
    where: { slug, ...published, artist: published },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      releaseDate: true,
      artist: { select: { id: true, name: true, slug: true } },
      tracks: {
        where: published,
        orderBy: [{ discNumber: "asc" }, { trackNumber: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          trackNumber: true,
          discNumber: true,
          durationSeconds: true,
        },
      },
    },
  });
}

export function getTrack(id: string) {
  return prisma.track.findFirst({
    where: { id, ...published, album: { ...published, artist: published } },
    select: {
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
        where: { artist: published },
        orderBy: { position: "asc" },
        select: {
          creditType: true,
          position: true,
          artist: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}
