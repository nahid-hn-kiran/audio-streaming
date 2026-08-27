import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }

    response.locals.auth = session;
    next();
  } catch (error) {
    console.error("Authentication lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    response.status(503).json({
      error: { code: "AUTHENTICATION_UNAVAILABLE", message: "Authentication service unavailable" },
    });
  }
}

export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (response.locals.auth?.user.role !== "ADMIN") {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Administrator access required" } });
    return;
  }

  next();
}
