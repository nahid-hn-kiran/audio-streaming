"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAlbum, type Album, type Track } from "@/lib/catalog";
import { TrackRow } from "@/components/track-row";
import { AudioPlayer } from "@/components/audio-player";
import { SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/catalog-states";
export default function AlbumDetailPage() { const params = useParams<{ slug: string }>(); const [album, setAlbum] = useState<Album | null>(null); const [selected, setSelected] = useState<Track | null>(null); const [state, setState] = useState<"loading" | "ready" | "error">("loading"); useEffect(() => { if (!params.slug) return; void getAlbum(params.slug).then((r) => { setAlbum(r.data); setState("ready"); }).catch(() => setState("error")); }, [params.slug]); return <><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-10 pb-32">{state === "loading" ? <LoadingState /> : state === "error" || !album ? <ErrorState label="Album not found or unavailable." /> : <><p className="text-sm uppercase tracking-widest text-gray-500">Album</p><h1 className="mt-2 text-4xl font-semibold">{album.title}</h1>{album.artist && <p className="mt-3 text-gray-600">by {album.artist.name}</p>}{album.description && <p className="mt-4 max-w-2xl text-gray-600">{album.description}</p>}<h2 className="mt-12 text-2xl font-semibold">Tracks</h2>{album.tracks?.length ? <div className="mt-4 rounded-xl border">{album.tracks.map((track) => <TrackRow key={track.id} track={{ ...track, album }} onSelect={setSelected} />)}</div> : <EmptyState label="No published tracks yet." />}<AudioPlayer track={selected} /></>}</main></>; }
