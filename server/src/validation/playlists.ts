import { z } from "zod";
export const playlistId = z.object({ id: z.uuid() });
export const trackParams = z.object({ id: z.uuid(), trackId: z.uuid() });
export const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const createPlaylist = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), visibility: z.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE") }).strict();
export const updatePlaylist = createPlaylist.partial().refine((v) => Object.keys(v).length > 0, "At least one field is required").strict();
export const addTrack = z.object({ trackId: z.uuid() }).strict();
export const reorder = z.object({ trackIds: z.array(z.uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, "Track IDs must be unique") }).strict();
