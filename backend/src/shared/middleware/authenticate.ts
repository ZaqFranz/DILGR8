import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "@/shared/errors/AppError";
import { verifyAccessToken } from "@/shared/utils/jwt";
import { prisma } from "@/shared/db/prismaClient";

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Async because it re-checks the token against the DB on every request (see
// User.tokenVersion) - throwing here is a rejected promise, not a
// synchronous throw, so every branch below must route errors through
// next(err) itself rather than relying on Express's default sync handling.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing bearer token"));
    return;
  }

  const token = header.slice("Bearer ".length);
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
    return;
  }

  try {
    // Re-fetched from the DB rather than trusted from the JWT claim, so a
    // role change or account deletion takes effect immediately instead of
    // waiting out the token's remaining lifetime.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      next(new UnauthorizedError("Invalid or expired token"));
      return;
    }
    req.user = { id: payload.sub, role: user.role, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Requires role: ${roles.join(" or ")}`);
    }
    next();
  };
}
