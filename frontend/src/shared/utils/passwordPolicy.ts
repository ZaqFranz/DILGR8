// Mirrors backend/src/shared/utils/password.ts's passwordPolicySchema - kept
// in sync by hand (no generated client in this codebase - see
// project-memory.md's Technical Debt). Used for inline client-side
// feedback only; the backend is the authoritative check.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_REQUIREMENTS_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.";

const COMMON_WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "qwerty123", "letmein123", "welcome123", "admin1234", "iloveyou1",
  "changeme1", "philippines1", "dilgadmin1", "p@ssw0rd", "p@ssword1",
]);

/** Returns the first validation error, or null if the password is valid. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "This password is too common - choose a less predictable one.";
  }
  return null;
}
