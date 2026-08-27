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

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl(path: string): string {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
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

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const nested = typeof body.error === "object" && body.error !== null ? body.error as Record<string, unknown> : {};
    const message = typeof body.message === "string" ? body.message : typeof nested.message === "string" ? nested.message : "Request failed. Please try again.";
    const code = typeof body.code === "string" ? body.code : typeof nested.code === "string" ? nested.code : undefined;
    throw new ApiError(message, response.status, code);
  }
  return payload as T;
}
