import { createAuthClient } from "better-auth/react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  baseURL: apiUrl ? `${apiUrl.replace(/\/$/, "")}/api/auth` : undefined,
  fetchOptions: { credentials: "include" },
});
