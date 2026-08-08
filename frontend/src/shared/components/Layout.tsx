import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith("/admin");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          DILGR8RSP
        </Link>
        <nav>
          {/* Admin navigation lives in AdminShell's sidebar, not here - this
              bar stays minimal (identity + logout) for the admin section. */}
          {isAuthenticated && user?.role === "APPLICANT" && (
            <>
              <NavLink to="/jobs" className={({ isActive }) => (isActive ? "active-link" : "")}>
                Job Postings
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => (isActive ? "active-link" : "")}>
                My Profile
              </NavLink>
              <NavLink to="/applications" className={({ isActive }) => (isActive ? "active-link" : "")}>
                My Applications
              </NavLink>
            </>
          )}
          {isAuthenticated ? (
            <>
              <span className="user-email">{user?.email}</span>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main className={isAdminSection ? "app-main app-main--full" : "app-main"}>{children}</main>
    </div>
  );
}
