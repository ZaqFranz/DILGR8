import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";

const SALT_ROUNDS = 10;

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt (and bcryptjs) silently truncates/ignores any bytes past 72 - two
// different passwords that only differ after that point would hash
// identically, so the max is capped here rather than left to look
// unlimited.
export const PASSWORD_MAX_LENGTH = 72;

// Not exhaustive - a full breached-password-database check (e.g. the Have
// I Been Pwned k-anonymity API) is future work - but blocks the handful of
// passwords that would otherwise trivially satisfy every composition rule
// below (e.g. "Password1!").
const COMMON_WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "qwerty123", "letmein123", "welcome123", "admin1234", "iloveyou1",
  "changeme1", "philippines1", "dilgadmin1", "p@ssw0rd", "p@ssword1",
]);

/**
 * Applied to registration and every "new password" field - not to login,
 * which just checks credentials against whatever hash is already stored.
 * Favors NIST 800-63B-style guidance (length + a blocklist of predictable
 * passwords) plus conventional composition rules, since a length-only
 * minimum still let through purely numeric or dictionary-word passwords.
 */
export const passwordPolicySchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((value) => /[a-z]/.test(value), "Password must include a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must include an uppercase letter")
  .refine((value) => /[0-9]/.test(value), "Password must include a number")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Password must include a special character")
  .refine(
    (value) => !COMMON_WEAK_PASSWORDS.has(value.toLowerCase()),
    "This password is too common - choose a less predictable one",
  );

const TEMP_PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz"; // excludes i/l/o (ambiguous)
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"; // excludes I/O (ambiguous)
const TEMP_PASSWORD_DIGITS = "23456789"; // excludes 0/1 (ambiguous)
const TEMP_PASSWORD_SPECIAL = "!@#$%^&*-_=+?";
const TEMP_PASSWORD_ALL = TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SPECIAL;

function randomChar(charset: string): string {
  return charset.charAt(randomInt(charset.length));
}

/**
 * Generates a one-time temporary password for the forgot-password flow.
 * Guarantees at least one lowercase/uppercase/digit/special character so it
 * satisfies passwordPolicySchema on its own, in case an applicant keeps it
 * as their new password when forced to change it.
 */
export function generateTemporaryPassword(length = 12): string {
  const required = [
    randomChar(TEMP_PASSWORD_LOWER),
    randomChar(TEMP_PASSWORD_UPPER),
    randomChar(TEMP_PASSWORD_DIGITS),
    randomChar(TEMP_PASSWORD_SPECIAL),
  ];
  const remaining = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    randomChar(TEMP_PASSWORD_ALL),
  );
  const chars = [...required, ...remaining];
  // Fisher-Yates shuffle - the required characters must not always land in
  // the same first four positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const temp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = temp;
  }
  return chars.join("");
}
