import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith("/admin");
  // The login page and the registration flow's unauthenticated "create an
  // account" step get the full-bleed branded .auth-page treatment - the top
  // nav (which would only offer "Log in"/"Register" links anyway, i.e.
  // exactly where the visitor already is) is dropped for a cleaner, more
  // immersive full-page look. The rest of the registration wizard, once
  // authenticated, keeps the normal header.
  const hideHeader = location.pathname === "/login" || (location.pathname === "/register" && !isAuthenticated);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      {!hideHeader && (
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
            {isAuthenticated && user?.role === "PANEL" && (
              <NavLink to="/panel/interviews" className={({ isActive }) => (isActive ? "active-link" : "")}>
                My Interviews
              </NavLink>
            )}
            {isAuthenticated ? (
              <>
                <NavLink to="/account/password" className={({ isActive }) => (isActive ? "active-link" : "")}>
                  Change Password
                </NavLink>
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
      )}
      <main className={isAdminSection ? "app-main app-main--full" : "app-main"}>{children}</main>
    </div>
  );
}
