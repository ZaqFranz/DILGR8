import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "@/config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
  tokenVersion: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"], algorithm: "HS256" };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as AccessTokenPayload;
}
