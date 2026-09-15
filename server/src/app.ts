import cors from "cors";
import express, { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { authRateLimit } from "./middleware/rate-limit.js";
import { catalogRouter } from "./routes/catalog.js";
import { adminCatalogRouter } from "./routes/admin-catalog.js";
import { mediaRouter } from "./routes/media.js";
import { playlistsRouter } from "./routes/playlists.js";
import { likesHistoryRouter } from "./routes/likes-history.js";
import { uploadRateLimit } from "./middleware/rate-limit.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

// Better Auth must receive the request before Express's JSON body parser.
app.all("/api/auth/{*any}", authRateLimit, toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/v1", catalogRouter);
app.use("/api/v1/admin", adminCatalogRouter);
app.use("/api/v1/admin/tracks/:id/audio/upload", uploadRateLimit);
app.use("/api/v1/admin/uploads/:id/complete", uploadRateLimit);
app.use("/api/v1", mediaRouter);
app.use("/api/v1/playlists", playlistsRouter);
app.use("/api/v1", likesHistoryRouter);
app.use("/api", authRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript + Express!");
});

app.use(
  (
    _error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next;
    console.error("Unhandled request failure", {
      error: _error instanceof Error ? _error.name : "UnknownError",
      method: _request.method,
      path: _request.path,
      timestamp: new Date().toISOString(),
    });
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  },
);
