import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { ApiError } from "@/shared/api/apiClient";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Logged in successfully.");
      // "/" defers to HomeRedirect, which sends admins to /admin/jobs and
      // applicants to /jobs - login itself doesn't know the role yet here.
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-form">
        <Link to="/" className="auth-logo-link">
          <img className="auth-logo" src="/dilg-logo.webp" alt="DILG logo" />
        </Link>
        <h2>Log in</h2>
        <p className="muted">Welcome back to DILGR8RSP.</p>
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email" className="required">
              Email
            </label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password" className="required">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="field-hint">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
          </div>
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner size="sm" onDark />}
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
