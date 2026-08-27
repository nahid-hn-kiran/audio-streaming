"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getArtist, type Artist } from "@/lib/catalog";
import { AlbumCard } from "@/components/album-card";
import { SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/catalog-states";
export default function ArtistDetailPage() { const params = useParams<{ slug: string }>(); const [artist, setArtist] = useState<Artist | null>(null); const [state, setState] = useState<"loading" | "ready" | "error">("loading"); useEffect(() => { if (!params.slug) return; void getArtist(params.slug).then((r) => { setArtist(r.data); setState("ready"); }).catch(() => setState("error")); }, [params.slug]); return <><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-10">{state === "loading" ? <LoadingState /> : state === "error" || !artist ? <ErrorState label="Artist not found or unavailable." /> : <><p className="text-sm uppercase tracking-widest text-gray-500">Artist</p><h1 className="mt-2 text-4xl font-semibold">{artist.name}</h1>{artist.bio && <p className="mt-4 max-w-2xl text-gray-600">{artist.bio}</p>}<h2 className="mt-12 text-2xl font-semibold">Published albums</h2>{artist.albums?.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{artist.albums.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <EmptyState label="No published albums yet." />}</>}</main></>; }
