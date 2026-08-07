import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

interface Props {
  children: ReactNode;
  /** Restrict this route to a single role. Omit to allow any authenticated user. */
  role?: "ADMIN" | "APPLICANT";
}

const HOME_BY_ROLE: Record<"ADMIN" | "APPLICANT", string> = {
  ADMIN: "/admin/jobs",
  APPLICANT: "/jobs",
};

export function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  // Wait for the stored session to load before deciding to redirect -
  // otherwise an already-logged-in user landing here gets bounced to
  // /login during the one render before localStorage has been read.
  if (isLoading) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  // Admins only post jobs and evaluate applicants; applicants only manage
  // their own registration/applications - each is bounced to their own
  // home rather than shown the other role's pages.
  if (role && user.role !== role) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }
  return <>{children}</>;
}
