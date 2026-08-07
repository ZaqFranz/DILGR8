import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

/**
 * Single shared Prisma client instance for the process. Repositories
 * receive it via constructor injection (see shared/container.ts) rather
 * than importing it directly, so they stay unit-testable against a mock.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
