import Link from "next/link";
import type { Album } from "@/lib/catalog";
export function AlbumCard({ album }: { album: Album }) { return <Link href={`/albums/${encodeURIComponent(album.slug)}`} className="block rounded-xl border p-5 transition hover:border-black"><h3 className="font-semibold">{album.title}</h3>{album.releaseDate && <p className="mt-1 text-sm text-gray-500">{new Date(album.releaseDate).getFullYear()}</p>}{album.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{album.description}</p>}</Link>; }
