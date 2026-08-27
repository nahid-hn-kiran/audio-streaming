import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
  OBJECT_STORAGE_PROVIDER: z.enum(["r2"]).default("r2"),
  OBJECT_STORAGE_ENDPOINT: z.url().optional(),
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET: z.string().default("audio-streaming"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  MAX_AUDIO_UPLOAD_BYTES: z.coerce.number().int().positive().default(104857600),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  PLAYBACK_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  UPLOAD_CLEANUP_GRACE_SECONDS: z.coerce.number().int().positive().default(86400),
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return;

  for (const field of ["CLIENT_ORIGIN", "BETTER_AUTH_URL"] as const) {
    if (new URL(values[field]).protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} must use HTTPS in production`,
      });
    }
  }
  for (const field of ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY"] as const) {
    if (!values[field]) context.addIssue({ code: "custom", path: [field], message: `${field} is required in production` });
  }
});

export const env = environmentSchema.parse(process.env);
