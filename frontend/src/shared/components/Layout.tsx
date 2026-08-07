import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          DILGR8RSP
        </Link>
        <nav>
          {isAuthenticated ? (
            <>
              <Link to="/jobs">Job Postings</Link>
              <Link to="/registration">My Profile</Link>
              <Link to="/applications">My Applications</Link>
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
      <main className="app-main">{children}</main>
    </div>
  );
}
