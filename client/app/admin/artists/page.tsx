"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { listArtists, type Artist } from "@/lib/catalog";
import { adminCreateArtist } from "@/lib/admin-catalog";
import { AdminList } from "@/components/admin-list";
import { AdminResourceForm } from "@/components/admin-resource-form";
import { EmptyState, ErrorState, LoadingState } from "@/components/catalog-states";
export default function AdminArtists() { const [items, setItems] = useState<Artist[]>([]); const [state, setState] = useState("loading"); const load = useCallback(() => { setState("loading"); void listArtists(1, 100).then((r) => { setItems(r.data); setState("ready"); }).catch(() => setState("error")); }, []); useEffect(load, [load]); return <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[320px_1fr]"><AdminResourceForm title="Create artist" fields={[{ name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "bio", label: "Bio" }]} onSubmit={async (values) => { await adminCreateArtist({ name: values.name, slug: values.slug, bio: values.bio }); load(); }} /><section><h1 className="mb-4 text-2xl font-semibold">Artists</h1>{state === "loading" ? <LoadingState /> : state === "error" ? <ErrorState /> : !items.length ? <EmptyState /> : <AdminList type="artists" items={items} onRefresh={load} />}</section></main>; }
