"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
export default function AccountPage() { const router = useRouter(); const { user, status, logout } = useAuth(); useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]); if (status === "loading" || !user) return <main className="grid min-h-screen place-items-center p-8">Loading…</main>; return <main className="mx-auto grid min-h-screen max-w-lg gap-4 p-8"><h1 className="text-2xl font-semibold">Your account</h1><p>{user.name} · {user.email}</p><button onClick={() => { void logout().then(() => router.replace("/")); }} className="w-fit rounded bg-black px-4 py-2 text-white">Log out</button></main>; }
