import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { authRateLimit } from "./middleware/rate-limit.js";
import { catalogRouter } from "./routes/catalog.js";
import { adminCatalogRouter } from "./routes/admin-catalog.js";
import { mediaRouter } from "./routes/media.js";
import { playlistsRouter } from "./routes/playlists.js";

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
app.use("/api/v1", mediaRouter);
app.use("/api/v1/playlists", playlistsRouter);
app.use("/api", authRouter);

app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next;
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
});
