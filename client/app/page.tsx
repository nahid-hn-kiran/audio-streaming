"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listArtists, type Artist } from "@/lib/catalog";
import { ArtistCard } from "@/components/artist-card";
import { SiteHeader } from "@/components/site-header";
import { ErrorState, LoadingState } from "@/components/catalog-states";

export default function HomePage() {
  const [artists, setArtists] = useState<Artist[]>([]); const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { void listArtists(1, 6).then((result) => setArtists(result.data)).catch(() => setError(true)).finally(() => setLoading(false)); }, []);
  return <><SiteHeader /><main className="mx-auto max-w-6xl px-4 pb-20"><section className="py-20"><p className="mb-3 text-sm uppercase tracking-widest text-gray-500">Your soundtrack, everywhere</p><h1 className="max-w-2xl text-5xl font-semibold tracking-tight">Discover music from artists worth hearing.</h1><p className="mt-5 max-w-xl text-gray-600">Browse the public catalog and play published releases instantly.</p><Link href="/artists" className="mt-8 inline-block rounded bg-black px-5 py-3 text-white">Browse artists</Link></section><section><div className="mb-5 flex items-end justify-between"><h2 className="text-2xl font-semibold">Featured artists</h2><Link href="/artists" className="text-sm underline">View all</Link></div>{loading ? <LoadingState /> : error ? <ErrorState /> : artists.length === 0 ? <p className="text-gray-500">No published artists yet.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div>}</section></main></>;
}
