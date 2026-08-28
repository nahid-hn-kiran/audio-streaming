"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addTrack, deletePlaylist, getPlaylist, removeTrack, reorderPlaylist, updatePlaylist, type Playlist } from "@/lib/playlists";
import { getAlbum, listArtists, type Track } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { usePlayback } from "@/components/player/playback-provider";
import { TrackRow } from "@/components/track-row";
import { Artwork } from "@/components/catalog/artwork";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/catalog/footer";
import { AuthGuard } from "@/components/auth/auth-guard";
import { EmptyState, ErrorState } from "@/components/catalog-states";

export default function PlaylistDetail() { return <AuthGuard><PlaylistContent /></AuthGuard>; }

function PlaylistContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { play } = usePlayback();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [available, setAvailable] = useState<Track[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try { setState("loading"); const result = await getPlaylist(id); setPlaylist(result.data); setState("ready"); }
    catch (cause) { setState("error"); setError(cause instanceof ApiError ? cause.message : "This playlist is unavailable."); }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    void listArtists(1, 100).then(async (result) => {
      const albums = result.data.flatMap((artist) => artist.albums ?? []);
      const details = await Promise.all(albums.map((album) => getAlbum(album.slug).then((response) => response.data).catch(() => null)));
      setAvailable(details.flatMap((album) => album?.tracks ?? []));
    }).catch(() => undefined);
  }, [load]);

  async function mutate(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError("");
    try { await action(); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  function reorder(index: number, direction: number) {
    if (!playlist?.tracks) return;
    const ids = playlist.tracks.map((item) => item.track.id); const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void mutate(() => reorderPlaylist(id, ids), "Track order updated.");
  }

  if (state === "loading") return <><SiteHeader /><main className="mx-auto max-w-6xl px-5 py-10 pb-32"><PlaylistSkeleton /></main><Footer /></>;
  if (state === "error" || !playlist) return <><SiteHeader /><main className="mx-auto max-w-6xl px-5 py-20"><ErrorState label={error || "This playlist is unavailable."} /><button onClick={() => void load()} className="mt-4 rounded border px-4 py-2">Try again</button></main><Footer /></>;

  const tracks = playlist.tracks ?? []; const firstTrack = tracks[0]?.track;
  return <><SiteHeader /><main className="mx-auto max-w-6xl px-5 py-10 pb-32">
    <Link href="/playlists" className="text-sm text-[var(--muted)] hover:text-white">← Your playlists</Link>
    <section className="mt-8 grid items-end gap-8 rounded-[var(--radius-lg)] border bg-[var(--surface)] p-6 md:grid-cols-[auto_1fr]">
      <Artwork label={playlist.name} size="lg" /><div><p className="text-sm uppercase tracking-[.25em] text-[var(--accent)]">Playlist</p><h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{playlist.name}</h1><p className="mt-3 text-sm text-[var(--muted)]">{playlist.visibility} · {tracks.length} tracks</p>{playlist.description && <p className="mt-4 max-w-xl text-[var(--muted)]">{playlist.description}</p>}<div className="mt-7 flex flex-wrap gap-3"><button disabled={busy || !firstTrack} onClick={() => firstTrack && play(firstTrack)} className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-black">Play all</button><button disabled={busy} onClick={() => setAddOpen(true)} className="rounded border px-4 py-3">Add tracks</button><button disabled={busy} onClick={() => setEditOpen(true)} className="rounded border px-4 py-3">Edit playlist</button><button disabled={busy} onClick={() => setConfirmDelete(true)} className="rounded border border-[var(--danger)]/50 px-4 py-3 text-[var(--danger)]">Delete</button></div></div>
    </section>
    {notice && <p role="status" className="mt-4 text-sm text-[var(--accent)]">{notice}</p>}{error && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
    <section className="mt-10"><h2 className="mb-4 text-2xl font-semibold">Tracks</h2>{tracks.length ? <div className="overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface)]">{tracks.map((item, index) => <div key={item.track.id} className="flex items-center"><div className="grow"><TrackRow track={item.track} /></div><div className="flex shrink-0 gap-1 pr-3"><button disabled={busy || index === 0} onClick={() => reorder(index, -1)} aria-label="Move track up" className="rounded px-2 py-2 hover:bg-[var(--surface-hover)]">↑</button><button disabled={busy || index === tracks.length - 1} onClick={() => reorder(index, 1)} aria-label="Move track down" className="rounded px-2 py-2 hover:bg-[var(--surface-hover)]">↓</button><button disabled={busy} onClick={() => void mutate(() => removeTrack(id, item.track.id), "Track removed.")} className="px-2 text-sm text-[var(--danger)]">Remove</button></div></div>)}</div> : <EmptyState label="This playlist is empty. Add a published track to begin." />}</section>
  </main>{addOpen && <AddTracks tracks={available.filter((track) => !tracks.some((item) => item.track.id === track.id))} busy={busy} onClose={() => setAddOpen(false)} onAdd={(trackId) => void mutate(() => addTrack(id, trackId), "Track added.")} />}{editOpen && <EditPlaylist playlist={playlist} busy={busy} onClose={() => setEditOpen(false)} onSave={(input) => void mutate(() => updatePlaylist(id, input), "Playlist updated.")} />}{confirmDelete && <DeleteDialog busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => { setBusy(true); void deletePlaylist(id).then(() => router.replace("/playlists")).catch((cause) => setError(cause instanceof ApiError ? cause.message : "Could not delete playlist.")).finally(() => setBusy(false)); }} />}<Footer /></>;
}

function AddTracks({ tracks, busy, onClose, onAdd }: { tracks: Track[]; busy: boolean; onClose: () => void; onAdd: (id: string) => void }) { const [selected, setSelected] = useState(""); return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><div className="w-full max-w-lg rounded-[var(--radius-md)] border bg-[var(--surface-raised)] p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Add tracks</h2><button onClick={onClose} aria-label="Close">×</button></div>{tracks.length ? <><select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-6 w-full rounded border bg-[var(--surface)] p-3"><option value="">Choose a published track</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}</select><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded border px-4 py-2">Cancel</button><button disabled={!selected || busy} onClick={() => onAdd(selected)} className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-black">Add track</button></div></> : <EmptyState label="No other published tracks are available." />}</div></div>; }
function EditPlaylist({ playlist, busy, onClose, onSave }: { playlist: Playlist; busy: boolean; onClose: () => void; onSave: (input: { name: string; description?: string; visibility: Playlist["visibility"] }) => void }) { const [name, setName] = useState(playlist.name); const [description, setDescription] = useState(playlist.description ?? ""); const [visibility, setVisibility] = useState(playlist.visibility); return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave({ name: name.trim(), description: description.trim() || undefined, visibility }); }} className="w-full max-w-lg space-y-4 rounded-[var(--radius-md)] border bg-[var(--surface-raised)] p-6"><h2 className="text-xl font-semibold">Edit playlist</h2><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="w-full rounded border bg-[var(--surface)] p-3" aria-label="Playlist name" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} className="min-h-24 w-full rounded border bg-[var(--surface)] p-3" aria-label="Description" /><select value={visibility} onChange={(event) => setVisibility(event.target.value as Playlist["visibility"])} className="w-full rounded border bg-[var(--surface)] p-3" aria-label="Visibility"><option>PRIVATE</option><option>PUBLIC</option><option>UNLISTED</option></select><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border px-4 py-2">Cancel</button><button disabled={busy} className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-black">Save</button></div></form></div>; }
function DeleteDialog({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"><div className="w-full max-w-md rounded-[var(--radius-md)] border bg-[var(--surface-raised)] p-6"><h2 className="text-xl font-semibold">Delete playlist?</h2><p className="mt-2 text-sm text-[var(--muted)]">This removes the playlist and its track list. Tracks themselves are not deleted.</p><div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="rounded border px-4 py-2">Cancel</button><button disabled={busy} onClick={onConfirm} className="rounded bg-[var(--danger)] px-4 py-2 text-black">Delete</button></div></div></div>; }
function PlaylistSkeleton() { return <div className="animate-pulse space-y-8"><div className="h-80 rounded-[var(--radius-lg)] bg-[var(--surface)]" /><div className="space-y-3"><div className="h-14 rounded bg-[var(--surface)]" /><div className="h-14 rounded bg-[var(--surface)]" /><div className="h-14 rounded bg-[var(--surface)]" /></div></div>; }
