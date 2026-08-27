"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTrack, type Track } from "@/lib/catalog";
import { AudioPlayer } from "@/components/audio-player";
import { SiteHeader } from "@/components/site-header";
import { ErrorState, LoadingState } from "@/components/catalog-states";
export default function TrackDetailPage() { const params = useParams<{ id: string }>(); const [track, setTrack] = useState<Track | null>(null); const [state, setState] = useState<"loading" | "ready" | "error">("loading"); useEffect(() => { if (!params.id) return; void getTrack(params.id).then((r) => { setTrack(r.data); setState("ready"); }).catch(() => setState("error")); }, [params.id]); return <><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-10 pb-32">{state === "loading" ? <LoadingState /> : state === "error" || !track ? <ErrorState label="Track not found or unavailable." /> : <><p className="text-sm uppercase tracking-widest text-gray-500">Track</p><h1 className="mt-2 text-4xl font-semibold">{track.title}</h1>{track.album && <p className="mt-3 text-gray-600">From <Link className="underline" href={`/albums/${encodeURIComponent(track.album.slug)}`}>{track.album.title}</Link></p>}<AudioPlayer track={track} /></>}</main></>; }
