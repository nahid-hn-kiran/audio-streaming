import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
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
});

export const env = environmentSchema.parse(process.env);
