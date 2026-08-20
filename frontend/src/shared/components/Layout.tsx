import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLandingPage = location.pathname === "/" && !isAuthenticated;
  const isAdminSection = location.pathname.startsWith("/admin");
  // The landing page, login page, and the registration flow's unauthenticated
  // "create an account" step all get their own full-bleed treatment with a
  // self-contained nav (logo + Log in/Register) - the default top nav would
  // only offer the same two links, so it's dropped for a cleaner, more
  // immersive first screen. The rest of the registration wizard, once
  // authenticated, keeps the normal header.
  const hideHeader =
    (location.pathname === "/" && !isAuthenticated) ||
    location.pathname === "/login" ||
    (location.pathname === "/register" && !isAuthenticated);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Collapse the menu on every navigation (e.g. clicking "Change Password")
  // rather than leaving it open over the newly-loaded page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      {!hideHeader && (
        <header className="app-header">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/dilg-logo.webp" alt="" aria-hidden="true" />
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
                <NavLink to="/applications" className={({ isActive }) => (isActive ? "active-link" : "")}>
                  My Applications
                </NavLink>
                <NavLink to="/register" className={({ isActive }) => (isActive ? "active-link" : "")}>
                  My Profile
                </NavLink>
              </>
            )}
            {isAuthenticated && user?.role === "PANEL" && (
              <NavLink to="/panel/interviews" className={({ isActive }) => (isActive ? "active-link" : "")}>
                My Interviews
              </NavLink>
            )}
            {isAuthenticated ? (
              <div className="user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="user-menu-trigger"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span className="user-email">{user?.email}</span>
                  <span className="user-menu-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
                {menuOpen && (
                  <div className="user-menu-dropdown" role="menu">
                    <NavLink
                      to="/account/password"
                      role="menuitem"
                      className={({ isActive }) => (isActive ? "active-link" : "")}
                      onClick={() => setMenuOpen(false)}
                    >
                      Change Password
                    </NavLink>
                    <button type="button" role="menuitem" onClick={handleLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register">Register</Link>
              </>
            )}
          </nav>
        </header>
      )}
      <main className={isAdminSection || isLandingPage ? "app-main app-main--full" : "app-main"}>{children}</main>
    </div>
  );
}
