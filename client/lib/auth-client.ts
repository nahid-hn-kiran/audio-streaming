import { createAuthClient } from "better-auth/react";

// Empty means same-origin: better-auth falls back to window.location.origin + "/api/auth",
// which the Next.js rewrite proxies to the server.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  baseURL: apiUrl ? `${apiUrl.replace(/\/$/, "")}/api/auth` : undefined,
  fetchOptions: { credentials: "include" },
});
