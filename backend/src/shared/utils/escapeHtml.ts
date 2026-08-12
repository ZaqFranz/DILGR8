const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes the five HTML-significant characters in a string. Every email
 * template builds its HTML by hand-interpolating strings into template
 * literals (no templating engine that escapes automatically, unlike React
 * on the frontend) - any value that isn't itself a literal HTML fragment
 * (applicant name, job title, venue, admin remarks, etc.) must go through
 * this before being interpolated, or it becomes free-form HTML injection
 * in every email the system sends.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}
