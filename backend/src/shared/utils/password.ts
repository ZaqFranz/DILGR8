import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const SALT_ROUNDS = 10;

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

// Excludes visually ambiguous characters (0/O, 1/l/I) since this is read by
// a human off an email and retyped into a login form.
const TEMP_PASSWORD_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Generates a one-time temporary password for the forgot-password flow. */
export function generateTemporaryPassword(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += TEMP_PASSWORD_CHARSET[randomInt(TEMP_PASSWORD_CHARSET.length)];
  }
  return result;
}
