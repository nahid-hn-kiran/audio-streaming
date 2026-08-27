import Link from "next/link";
import type { Artist } from "@/lib/catalog";
export function ArtistCard({ artist }: { artist: Artist }) { return <Link href={`/artists/${encodeURIComponent(artist.slug)}`} className="block rounded-xl border p-5 transition hover:border-black"><h2 className="text-lg font-semibold">{artist.name}</h2>{artist.bio && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{artist.bio}</p>} {artist.albums && <p className="mt-3 text-xs text-gray-500">{artist.albums.length} published album{artist.albums.length === 1 ? "" : "s"}</p>}</Link>; }
