import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function LoginPage() { return <main className="grid min-h-screen place-items-center p-8"><div className="grid gap-3"><AuthForm mode="login" /><Link className="text-center text-sm underline" href="/register">Need an account? Register</Link></div></main>; }
