import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();
const protectedOperations = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/forget-password",
  "/reset-password",
]);

function clientKey(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export function authRateLimit(request: Request, response: Response, next: NextFunction): void {
  if (!protectedOperations.has(request.path)) {
    next();
    return;
  }

  const key = clientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt };
  attempts.set(key, entry);

  if (entry.count > MAX_ATTEMPTS) {
    response.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
    response.status(429).json({
      error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts" },
    });
    return;
  }

  next();
}
