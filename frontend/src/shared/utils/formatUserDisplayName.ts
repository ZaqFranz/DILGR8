/** Full name if set (ADMIN/PANEL accounts can have one via Users Management), else falls back to email - used anywhere a user is picked/listed by a human-readable label (Positions, Interview Panel) instead of their raw email. */
export function formatUserDisplayName(user: { name: string | null; email: string }): string {
  return user.name || user.email;
}
