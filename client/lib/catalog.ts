import { apiFetch } from "@/lib/api";

export type Artist = { id: string; name: string; slug: string; bio?: string | null; albums?: Album[] };
export type Album = { id: string; title: string; slug: string; description?: string | null; releaseDate?: string | null; artist?: Pick<Artist, "id" | "name" | "slug">; tracks?: Track[] };
export type Track = { id: string; title: string; slug: string; trackNumber?: number | null; discNumber?: number | null; durationSeconds?: number | null; album?: Album; artists?: Array<{ creditType: string; position: number; artist: Pick<Artist, "id" | "name" | "slug"> }> };
export type Paginated<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

export const listArtists = (page = 1, limit = 12) => apiFetch<Paginated<Artist>>(`/api/v1/artists?page=${page}&limit=${limit}`);
export const getArtist = (slug: string) => apiFetch<{ data: Artist }>(`/api/v1/artists/${encodeURIComponent(slug)}`);
export const getAlbum = (slug: string) => apiFetch<{ data: Album }>(`/api/v1/albums/${encodeURIComponent(slug)}`);
export const getTrack = (id: string) => apiFetch<{ data: Track }>(`/api/v1/tracks/${encodeURIComponent(id)}`);
export const getPlayback = (id: string) => apiFetch<{ data: { url: string; expiresAt: string } }>(`/api/v1/tracks/${encodeURIComponent(id)}/playback`);
