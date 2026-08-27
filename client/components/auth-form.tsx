"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/components/auth-provider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter(); const { refresh } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const result = mode === "login" ? await authClient.signIn.email({ email, password }) : await authClient.signUp.email({ name, email, password });
      if (result.error) { setError(result.error.message || "Authentication failed. Please check your details."); return; }
      await refresh(); router.push("/account"); router.refresh();
    } catch { setError("Authentication service is unavailable. Please try again."); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="mx-auto grid w-full max-w-md gap-4 rounded-xl border p-6 shadow-sm">
    <h1 className="text-2xl font-semibold">{mode === "login" ? "Log in" : "Create account"}</h1>
    {mode === "register" && <label className="grid gap-1">Name<input required minLength={1} value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-2" /></label>}
    <label className="grid gap-1">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border p-2" /></label>
    <label className="grid gap-1">Password<input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded border p-2" /></label>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button disabled={loading} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{loading ? "Please wait…" : mode === "login" ? "Log in" : "Register"}</button>
  </form>;
}
