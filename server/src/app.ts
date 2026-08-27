import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { authRateLimit } from "./middleware/rate-limit.js";

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

app.use("/api", authRouter);
