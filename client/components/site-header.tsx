import Link from "next/link";
export function SiteHeader() { return <header className="border-b"><nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Link href="/" className="font-semibold">Audio Streaming</Link><div className="flex gap-4 text-sm"><Link href="/artists">Artists</Link><Link href="/account">Account</Link></div></nav></header>; }
