import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  // pino-http (see app.ts) reuses this instance for every request/response
  // log via child loggers, so redacting here covers it too - otherwise the
  // Bearer token and any cookie header would be written to logs in full.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers[\"set-cookie\"]"],
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
