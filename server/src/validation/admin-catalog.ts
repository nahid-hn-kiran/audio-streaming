import { z } from "zod";

const id = z.uuid();
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalDate = z.coerce.date().nullable().optional();

export const adminIdSchema = z.object({ id });
export const createArtistSchema = z.object({ name: z.string().trim().min(1).max(200), slug, bio: z.string().trim().max(5000).nullable().optional() }).strict();
export const updateArtistSchema = createArtistSchema.partial();
export const createAlbumSchema = z.object({ artistId: id, title: z.string().trim().min(1).max(200), slug, description: z.string().trim().max(5000).nullable().optional(), releaseDate: optionalDate }).strict();
export const updateAlbumSchema = createAlbumSchema.partial().omit({ artistId: true });
export const trackArtistSchema = z.object({ artistId: id, creditType: z.enum(["PRIMARY", "FEATURED"]).default("PRIMARY"), position: z.number().int().min(0).max(1000) }).strict();
export const createTrackSchema = z.object({ albumId: id, title: z.string().trim().min(1).max(200), slug, trackNumber: z.number().int().min(1).max(10_000), discNumber: z.number().int().min(1).max(1000).default(1), durationSeconds: z.number().int().positive().nullable().optional(), artists: z.array(trackArtistSchema).max(100).default([]) }).strict();
export const updateTrackSchema = createTrackSchema.partial().omit({ albumId: true });
