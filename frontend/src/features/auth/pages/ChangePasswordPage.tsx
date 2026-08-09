import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { changePassword } from "../api/authApi";

export function ChangePasswordPage() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function fieldClass(name: string): string {
    return fieldErrors[name] ? "field has-error" : "field";
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (!newPassword) errors.newPassword = "New password is required.";
    else if (newPassword.length < 8) errors.newPassword = "New password must be at least 8 characters.";
    if (confirmPassword !== newPassword) errors.confirmPassword = "Passwords do not match.";
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fill in the highlighted field(s) before continuing.");
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to change password");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="centered-page">
      <h1>Change Password</h1>
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit} noValidate>
          <div className={fieldClass("currentPassword")}>
            <label htmlFor="currentPassword" className="required">
              Current password
            </label>
            <PasswordInput
              id="currentPassword"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <FieldError message={fieldErrors.currentPassword} />
          </div>
          <div className={fieldClass("newPassword")}>
            <label htmlFor="newPassword" className="required">
              New password
            </label>
            <PasswordInput
              id="newPassword"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <FieldError message={fieldErrors.newPassword} />
            {!fieldErrors.newPassword && <p className="field-hint">At least 8 characters.</p>}
          </div>
          <div className={fieldClass("confirmPassword")}>
            <label htmlFor="confirmPassword" className="required">
              Confirm new password
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <FieldError message={fieldErrors.confirmPassword} />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner size="sm" onDark />}
            {submitting ? "Changing password..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
