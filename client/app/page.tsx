import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center p-8"><section className="grid gap-4 text-center">
      <h1 className="text-3xl font-semibold">Audio Streaming Platform</h1>
      <div className="flex justify-center gap-3"><Link className="rounded border px-4 py-2" href="/login">Log in</Link><Link className="rounded bg-black px-4 py-2 text-white" href="/register">Register</Link></div>
      <Link className="text-sm underline" href="/account">Your account</Link>
    </section>
    </main>
  );
}
