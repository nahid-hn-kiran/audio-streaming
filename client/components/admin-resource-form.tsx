"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

type Field = { name: string; label: string; type?: string; required?: boolean; options?: Array<{ value: string; label: string }> };

export function AdminResourceForm({ title, fields, onSubmit }: { title: string; fields: Field[]; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setLoading(true);
    try { await onSubmit(values); setMessage("Saved successfully."); setValues({}); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : "Could not save this resource."); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-[var(--radius-md)] border bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]"><h2 className="text-lg font-semibold">{title}</h2>{fields.map((field) => <label key={field.name} className="grid gap-1 text-sm">{field.label}{field.options ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="rounded border bg-[var(--surface-raised)] p-2"><option value="">Select…</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input required={field.required} type={field.type ?? "text"} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="rounded border bg-[var(--surface-raised)] p-2" />}</label>)}{message && <p role="status" className="text-sm text-[var(--accent)]">{message}</p>}<button disabled={loading} className="w-fit rounded bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">{loading ? "Saving…" : "Save"}</button></form>;
}
