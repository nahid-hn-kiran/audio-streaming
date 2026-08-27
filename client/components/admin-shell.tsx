"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) { const { user, status } = useAuth(); const router = useRouter(); useEffect(() => { if (status === "unauthenticated") router.replace("/login"); else if (status === "authenticated" && user?.role !== "ADMIN") router.replace("/account"); }, [status, user, router]); if (status !== "authenticated" || user?.role !== "ADMIN") return <main className="grid min-h-screen place-items-center p-8">Checking admin access…</main>; return <><header className="border-b"><nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-4"><Link href="/admin" className="font-semibold">Admin</Link><Link href="/admin/artists">Artists</Link><Link href="/admin/albums">Albums</Link><Link href="/admin/tracks">Tracks</Link><Link href="/account" className="ml-auto">Account</Link></nav></header>{children}</>; }
