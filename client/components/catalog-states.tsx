export function LoadingState({ label = "Loading…" }: { label?: string }) { return <p className="py-12 text-center text-gray-500" role="status">{label}</p>; }
export function EmptyState({ label = "Nothing to show yet." }: { label?: string }) { return <p className="py-12 text-center text-gray-500">{label}</p>; }
export function ErrorState({ label = "We could not load this catalog item." }: { label?: string }) { return <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700" role="alert">{label}</p>; }
