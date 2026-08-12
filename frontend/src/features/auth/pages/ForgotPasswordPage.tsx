import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Spinner } from "@/shared/components/Spinner";
import { ApiError } from "@/shared/api/apiClient";
import { forgotPassword } from "../api/authApi";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-form">
        <img className="auth-logo" src="/dilg-logo.webp" alt="DILG logo" />
        <h2>Forgot password</h2>
        <p className="muted">
          Enter the email on your applicant account and we&apos;ll send you a temporary password.
        </p>
        {submitted ? (
          <>
            <p>
              If an applicant account exists for <strong>{email}</strong>, a temporary password has been sent to it.
              Log in with it below - you&apos;ll be asked to set a new password right away.
            </p>
            <p className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </p>
          </>
        ) : (
          <>
            <ErrorBanner message={error} />
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email" className="required">
                  Email
                </label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting}>
                {submitting && <Spinner size="sm" onDark />}
                {submitting ? "Sending..." : "Send temporary password"}
              </button>
            </form>
            <p className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
