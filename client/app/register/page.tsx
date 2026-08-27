import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function RegisterPage() { return <main className="grid min-h-screen place-items-center p-8"><div className="grid gap-3"><AuthForm mode="register" /><Link className="text-center text-sm underline" href="/login">Already registered? Log in</Link></div></main>; }
