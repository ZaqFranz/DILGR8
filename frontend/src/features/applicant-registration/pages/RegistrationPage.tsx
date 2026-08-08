import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { completeRegistration, getMyProfile } from "../api/applicantsApi";
import { listMyDocuments } from "../api/documentsApi";
import { DemographicProfileForm } from "../components/DemographicProfileForm";
import { WorkExperienceSection } from "../components/WorkExperienceSection";
import { LdInterventionSection } from "../components/LdInterventionSection";
import { AwardsSection } from "../components/AwardsSection";
import { DocumentsSection } from "../components/DocumentsSection";
import type { ApplicantDocument, ApplicantProfile } from "../types";

type Step = "account" | "profile" | "experience" | "learning" | "awards" | "documents";

const STEPS: { id: Step; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "profile", label: "Demographic Profile" },
  { id: "experience", label: "Work Experience" },
  { id: "learning", label: "Learning & Development" },
  { id: "awards", label: "Awards" },
  { id: "documents", label: "Documents" },
];

/**
 * The entire applicant registration flow: account creation through
 * demographic profile, work experience, L&D, awards, and documents, all in
 * one continuous process. Nothing here is deferred to "after logging in" -
 * an applicant isn't routed to the rest of the app (see ProtectedRoute)
 * until every step is finished.
 */
export function RegistrationPage() {
  const { isAuthenticated, isLoading, user, register, registrationComplete, refreshRegistrationStatus } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [step, setStep] = useState<Step>("account");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountFieldErrors, setAccountFieldErrors] = useState<Record<string, string>>({});
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const [finishSubmitting, setFinishSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingProfile(true);
    Promise.all([getMyProfile(), listMyDocuments().catch(() => [])])
      .then(([loadedProfile, loadedDocuments]) => {
        setProfile(loadedProfile);
        setDocuments(loadedDocuments);
        setStep("profile");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your profile"))
      .finally(() => setLoadingProfile(false));
  }, [isAuthenticated]);

  if (isLoading) return null;

  // Admins have no registration flow of their own.
  if (isAuthenticated && user?.role === "ADMIN") {
    return <Navigate to="/admin/jobs" replace />;
  }

  // Already fully registered and just browsing here from "My Profile" -
  // let them through so they can still edit their record, but don't force
  // them back through account creation.
  const alreadyRegistered = isAuthenticated && registrationComplete === true;

  function validateAccount(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    return errors;
  }

  async function handleAccountSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAccountFieldErrors({});

    const validationErrors = validateAccount();
    if (Object.keys(validationErrors).length > 0) {
      setAccountFieldErrors(validationErrors);
      setError("Please fill in the highlighted field(s) before continuing.");
      return;
    }

    setAccountSubmitting(true);
    try {
      await register(email, password);
      toast.success("Account created.");
      setStep("profile");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setAccountFieldErrors(getFieldErrors(err));
      } else {
        setError("Registration failed");
      }
    } finally {
      setAccountSubmitting(false);
    }
  }

  function handleProfileSaved(saved: ApplicantProfile) {
    const isFirstSave = !profile;
    setProfile(saved);
    toast.success(isFirstSave ? "Profile created." : "Profile updated.");
    if (isFirstSave) {
      setStep("experience");
    }
  }

  const missingEligibilityProof = Boolean(
    profile?.hasEligibility && !documents.some((doc) => doc.type === "ELIGIBILITY_PROOF"),
  );

  async function handleFinish() {
    if (missingEligibilityProof) {
      setError("Upload proof of eligibility in the Documents section before finishing registration.");
      return;
    }
    setError(null);
    setFinishSubmitting(true);
    try {
      await completeRegistration();
      await refreshRegistrationStatus();
      toast.success(alreadyRegistered ? "Profile saved." : "Registration complete — welcome to DILGR8RSP!");
      navigate("/jobs");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete registration");
    } finally {
      setFinishSubmitting(false);
    }
  }

  const visibleSteps = isAuthenticated ? STEPS.filter((s) => s.id !== "account") : STEPS;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isLastStep = step === "documents";

  return (
    <div>
      <h1>Applicant Registration</h1>
      <p className="muted">
        Step {stepIndex + 1} of {STEPS.length}
        {alreadyRegistered ? " — editing your completed registration" : ""}
      </p>
      <ErrorBanner message={error} />

      {isAuthenticated && (
        <div className="wizard-steps">
          {visibleSteps.map((s) => {
            const disabled = s.id !== "profile" && !profile;
            return (
              <button
                key={s.id}
                type="button"
                className={step === s.id ? "active" : ""}
                disabled={disabled}
                onClick={() => setStep(s.id)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {step === "account" && !isAuthenticated && (
        <div className="card auth-form">
          <h2>Create an applicant account</h2>
          <p className="muted">
            This is step 1 of {STEPS.length} - the rest of your applicant information follows immediately after.
          </p>
          <form onSubmit={handleAccountSubmit} noValidate>
            <div className={`field${accountFieldErrors.email ? " has-error" : ""}`}>
              <label htmlFor="email" className="required">
                Email
              </label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <FieldError message={accountFieldErrors.email} />
            </div>
            <div className={`field${accountFieldErrors.password ? " has-error" : ""}`}>
              <label htmlFor="password" className="required">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FieldError message={accountFieldErrors.password} />
              {!accountFieldErrors.password && <p className="field-hint">At least 8 characters.</p>}
            </div>
            <button type="submit" disabled={accountSubmitting}>
              {accountSubmitting && <Spinner size="sm" onDark />}
              {accountSubmitting ? "Creating account..." : "Continue"}
            </button>
          </form>
        </div>
      )}

      {isAuthenticated && loadingProfile && <LoadingBlock label="Loading your profile..." />}

      {isAuthenticated && !loadingProfile && (
        <>
          {!profile && (
            <p>
              Continue by filling in your demographic profile below. The remaining sections unlock once your
              profile is created.
            </p>
          )}

          {(!profile || step === "profile") && (
            <DemographicProfileForm profile={profile} onSaved={handleProfileSaved} />
          )}

          {profile && step === "experience" && (
            <WorkExperienceSection
              items={profile.workExperiences}
              onChange={(workExperiences) => setProfile({ ...profile, workExperiences })}
            />
          )}

          {profile && step === "learning" && (
            <LdInterventionSection
              items={profile.ldInterventions}
              onChange={(ldInterventions) => setProfile({ ...profile, ldInterventions })}
            />
          )}

          {profile && step === "awards" && (
            <AwardsSection items={profile.awards} onChange={(awards) => setProfile({ ...profile, awards })} />
          )}

          {profile && step === "documents" && <DocumentsSection items={documents} onChange={setDocuments} />}

          {profile && isLastStep && missingEligibilityProof && (
            <p className="field-warning">
              You indicated you have a civil service eligibility — upload proof of it above before finishing
              registration.
            </p>
          )}

          {profile && (
            <div className="actions-row">
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(visibleSteps[Math.max(0, visibleSteps.findIndex((s) => s.id === step) - 1)]!.id)}
                disabled={step === "profile"}
              >
                Back
              </button>
              {isLastStep ? (
                <button type="button" onClick={handleFinish} disabled={finishSubmitting || missingEligibilityProof}>
                  {finishSubmitting && <Spinner size="sm" onDark />}
                  {finishSubmitting
                    ? "Finishing..."
                    : alreadyRegistered
                      ? "Save & return to job postings"
                      : "Finish registration & browse job postings"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setStep(visibleSteps[Math.min(visibleSteps.length - 1, visibleSteps.findIndex((s) => s.id === step) + 1)]!.id)
                  }
                >
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
