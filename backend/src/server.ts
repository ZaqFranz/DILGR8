import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/shared/logging/logger";
import { prisma } from "@/shared/db/prismaClient";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`DILGR8RSP API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
