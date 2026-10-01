export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Empty means same-origin: requests go through the Next.js /api rewrite proxy.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

function getApiUrl(path: string): string {
  return `${apiUrl.replace(/\/$/, "")}${path}`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("The service is unavailable. Please try again.", 0, "NETWORK_ERROR");
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const body = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const nested = typeof body.error === "object" && body.error !== null ? body.error as Record<string, unknown> : {};
    const fallback = response.status === 400 ? "Please check the submitted information." : response.status === 401 ? "Please sign in to continue." : response.status === 403 ? "You do not have permission to do that." : response.status === 404 ? "The requested resource is unavailable." : response.status === 409 ? "That action conflicts with the current state." : response.status === 429 ? "Too many requests. Please try again shortly." : response.status >= 500 ? "The service is temporarily unavailable." : "Request failed. Please try again.";
    const message = typeof body.message === "string" ? body.message : typeof nested.message === "string" ? nested.message : fallback;
    const code = typeof body.code === "string" ? body.code : typeof nested.code === "string" ? nested.code : undefined;
    throw new ApiError(message, response.status, code);
  }
  return payload as T;
}
