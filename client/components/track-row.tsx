"use client";
import type { Track } from "@/lib/catalog";
import Link from "next/link";
export function TrackRow({ track, onSelect }: { track: Track; onSelect: (track: Track) => void }) { return <div className="flex w-full items-center justify-between border-b px-3 py-4 hover:bg-gray-50"><button onClick={() => onSelect(track)} className="text-left"><span className="mr-3 text-sm text-gray-400">{track.trackNumber ?? "•"}</span><span className="font-medium">{track.title}</span></button><span className="flex items-center gap-3 text-sm text-gray-500"><Link href={`/tracks/${encodeURIComponent(track.id)}`} className="underline">Details</Link>{track.durationSeconds ? `${Math.floor(track.durationSeconds / 60)}:${String(track.durationSeconds % 60).padStart(2, "0")}` : "Play"}</span></div>; }
