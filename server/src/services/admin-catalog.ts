import { prisma } from "../lib/prisma.js";
import { PublicationStatus } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";

const artistSelect = { id: true, name: true, slug: true, bio: true, status: true } as const;
const albumSelect = { id: true, artistId: true, title: true, slug: true, description: true, releaseDate: true, status: true } as const;
const trackSelect = { id: true, albumId: true, title: true, slug: true, trackNumber: true, discNumber: true, durationSeconds: true, status: true } as const;

export type ArtistInput = { name: string; slug: string; bio?: string | null };
export type AlbumInput = { artistId: string; title: string; slug: string; description?: string | null; releaseDate?: Date | null };
export type TrackArtistInput = { artistId: string; creditType: "PRIMARY" | "FEATURED"; position: number };
export type TrackInput = { albumId: string; title: string; slug: string; trackNumber: number; discNumber: number; durationSeconds?: number | null; artists: TrackArtistInput[] };

export const createArtist = (input: ArtistInput) => prisma.artist.create({ data: { ...input, status: PublicationStatus.DRAFT }, select: artistSelect });
export const updateArtist = (id: string, input: Partial<ArtistInput>) => prisma.artist.update({ where: { id }, data: { ...input }, select: artistSelect });
export const createAlbum = (input: AlbumInput) => prisma.album.create({ data: { ...input, status: PublicationStatus.DRAFT }, select: albumSelect });
export const updateAlbum = (id: string, input: Partial<Omit<AlbumInput, "artistId">>) => prisma.album.update({ where: { id }, data: { ...input }, select: albumSelect });

export async function createTrack(input: TrackInput) {
  return prisma.$transaction(async (transaction) => {
    const track = await transaction.track.create({ data: { albumId: input.albumId, title: input.title, slug: input.slug, trackNumber: input.trackNumber, discNumber: input.discNumber, durationSeconds: input.durationSeconds, status: PublicationStatus.DRAFT }, select: trackSelect });
    if (input.artists.length) await transaction.trackArtist.createMany({ data: input.artists.map((artist) => ({ ...artist, trackId: track.id })) });
    return track;
  });
}

export async function updateTrack(id: string, input: Partial<Omit<TrackInput, "albumId">>) {
  return prisma.$transaction(async (transaction) => {
    const track = await transaction.track.update({ where: { id }, data: { title: input.title, slug: input.slug, trackNumber: input.trackNumber, discNumber: input.discNumber, durationSeconds: input.durationSeconds }, select: trackSelect });
    if (input.artists) {
      await transaction.trackArtist.deleteMany({ where: { trackId: id } });
      if (input.artists.length) await transaction.trackArtist.createMany({ data: input.artists.map((artist) => ({ ...artist, trackId: id })) });
    }
    return track;
  });
}

type Resource = "artist" | "album" | "track";
export async function changePublication(resource: Resource, id: string, status: PublicationStatus) {
  if (status === PublicationStatus.PUBLISHED) {
    if (resource === "album") {
      const album = await prisma.album.findUnique({ where: { id }, select: { artist: { select: { status: true } } } });
      if (!album) return null;
      if (album.artist.status !== PublicationStatus.PUBLISHED) throw new Error("PARENT_NOT_PUBLISHED");
    }
    if (resource === "track") {
      const track = await prisma.track.findUnique({ where: { id }, select: { album: { select: { status: true } }, artists: { where: { creditType: "PRIMARY" }, select: { artist: { select: { status: true } } } } } });
      if (!track) return null;
      if (track.album.status !== PublicationStatus.PUBLISHED) throw new Error("PARENT_NOT_PUBLISHED");
      if (track.artists.length !== 1 || track.artists[0].artist.status !== PublicationStatus.PUBLISHED) throw new Error("PRIMARY_ARTIST_REQUIRED");
    }
  }
  if (resource === "artist") return prisma.artist.update({ where: { id }, data: { status }, select: artistSelect });
  if (resource === "album") return prisma.album.update({ where: { id }, data: { status }, select: albumSelect });
  return prisma.track.update({ where: { id }, data: { status }, select: trackSelect });
}

export function isConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as Prisma.PrismaClientKnownRequestError).code === "P2002";
}
export function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as Prisma.PrismaClientKnownRequestError).code === "P2025";
}
