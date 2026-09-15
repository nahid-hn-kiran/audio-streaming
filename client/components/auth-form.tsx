"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/components/auth-provider";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { status, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (status === "authenticated") router.replace("/account");
  }, [status, router]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirm)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name, email, password });
      if (result.error) {
        setError(
          mode === "login"
            ? "Email or password is incorrect."
            : result.error.message || "We could not create your account.",
        );
        return;
      }
      await refresh();
      router.push("/");
    } catch {
      setError("Unable to connect to the music service. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div>
        <p className="text-sm uppercase tracking-[.2em] text-[var(--accent)]">
          {mode === "login" ? "Welcome back" : "Join the listening room"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {mode === "login"
            ? "Sign in to continue."
            : "Make room for more music."}
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          {mode === "login"
            ? "Pick up where you left off."
            : "Create your account and build your own space."}
        </p>
      </div>
      {mode === "register" && (
        <label className="grid gap-2 text-sm">
          Name
          <input
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[var(--radius-sm)] border bg-[var(--surface)] p-3"
          />
        </label>
      )}
      <label className="grid gap-2 text-sm">
        Email
        <input
          autoComplete="email"
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[var(--radius-sm)] border bg-[var(--surface)] p-3"
        />
      </label>
      <label className="grid gap-2 text-sm">
        Password
        <div className="flex rounded-[var(--radius-sm)] border bg-[var(--surface)]">
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 grow bg-transparent p-3 outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="px-3 text-sm text-[var(--muted)]"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      {mode === "register" && (
        <label className="grid gap-2 text-sm">
          Confirm password
          <input
            autoComplete="new-password"
            required
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-[var(--radius-sm)] border bg-[var(--surface)] p-3"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        disabled={loading}
        className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-3 font-semibold text-black"
      >
        {loading
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>
    </form>
  );
}
