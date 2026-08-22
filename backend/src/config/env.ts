import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  // All optional - EmailService falls back to logging emails instead of sending
  // them when SMTP_HOST isn't set, so local dev works with no mail server.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // NOT z.coerce.boolean() - Zod's coercion is just JS Boolean(value), which
  // makes the *string* "false" coerce to true (any non-empty string is
  // truthy). Explicit string comparison is the only safe way to parse a
  // boolean-shaped env var.
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_FROM: z.string().default("DILGR8RSP <no-reply@dilg.gov.ph>"),
  // Gates the historical-hiring-data module (see requireOwner in
  // shared/middleware/authenticate.ts) to exactly one account, by email -
  // not a Role, since every existing ADMIN account must still be blocked.
  // Left unset in most environments; the routes 403 everyone until this is
  // explicitly configured.
  HISTORICAL_DATA_OWNER_EMAIL: z.string().email().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
