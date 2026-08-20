import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthContext";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_HINT, validatePassword } from "@/shared/utils/passwordPolicy";
import { completeRegistration, getMyProfile } from "../api/applicantsApi";
import { listMyDocuments } from "../api/documentsApi";
import { DemographicProfileForm } from "../components/DemographicProfileForm";
import { LdInterventionSection } from "../components/LdInterventionSection";
import { AwardsSection } from "../components/AwardsSection";
import { DocumentsSection } from "../components/DocumentsSection";
import type { ApplicantDocument, ApplicantProfile } from "../types";

type Step = "account" | "profile" | "learning" | "awards" | "documents";

const STEPS: { id: Step; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "profile", label: "Demographic Profile" },
  { id: "learning", label: "Learning & Development" },
  { id: "awards", label: "Awards" },
  { id: "documents", label: "Documents" },
];

/**
 * The entire applicant registration flow: account creation through
 * demographic profile, L&D, awards, and documents, all in one continuous
 * process. Nothing here is deferred to "after logging in" - an applicant
 * isn't routed to the rest of the app (see ProtectedRoute) until every step
 * is finished. Work experience isn't collected here - it's already part of
 * the required PDS upload (Documents step), so asking for it twice would
 * just be duplicate data entry.
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
    } else {
      const passwordError = validatePassword(password);
      if (passwordError) errors.password = passwordError;
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
      setStep("learning");
    }
  }

  const missingPds = !documents.some((doc) => doc.type === "PDS");
  const missingPdsExcel = !documents.some((doc) => doc.type === "PDS_EXCEL");
  const missingEligibilityProof = Boolean(
    profile?.hasEligibility && !documents.some((doc) => doc.type === "ELIGIBILITY_PROOF"),
  );
  // Same rule as eligibility: claiming an L&D intervention or an award means
  // proof of that specific claim is required, not optional.
  const ldEntriesMissingProof = (profile?.ldInterventions ?? []).filter(
    (entry) => !documents.some((doc) => doc.type === "LD_PROOF" && doc.ldInterventionId === entry.id),
  );
  const awardsMissingProof = (profile?.awards ?? []).filter(
    (award) => !documents.some((doc) => doc.type === "AWARD_PROOF" && doc.awardId === award.id),
  );
  const missingRequiredDocuments =
    missingPds ||
    missingPdsExcel ||
    missingEligibilityProof ||
    ldEntriesMissingProof.length > 0 ||
    awardsMissingProof.length > 0;

  // Claiming an L&D entry or an award means proof of that specific claim is
  // required - block moving past that step (not just the final "Finish
  // registration") the moment an entry with no proof exists, same rule
  // completeRegistration() already enforces server-side.
  const nextBlockedOnCurrentStep =
    (step === "learning" && ldEntriesMissingProof.length > 0) ||
    (step === "awards" && awardsMissingProof.length > 0);

  async function handleFinish() {
    if (missingRequiredDocuments) {
      setError("Upload all required documents in the Documents section before finishing registration.");
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
      {isAuthenticated && (
        <>
          <h1>Applicant Registration</h1>
          <p className="muted">
            Step {stepIndex + 1} of {STEPS.length}
            {alreadyRegistered ? " — editing your completed registration" : ""}
          </p>
        </>
      )}
      {!(step === "account" && !isAuthenticated) && <ErrorBanner message={error} />}

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
        <div className="auth-page">
          <div className="card auth-form">
            <Link to="/" className="auth-logo-link">
              <img className="auth-logo" src="/dilg-logo.webp" alt="DILG logo" />
            </Link>
            <h2>Create an applicant account</h2>
            <p className="muted">
              This is step 1 of {STEPS.length} - the rest of your applicant information follows immediately after.
            </p>
            <ErrorBanner message={error} />
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
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldError message={accountFieldErrors.password} />
                {!accountFieldErrors.password && <p className="field-hint">{PASSWORD_REQUIREMENTS_HINT}</p>}
              </div>
              <button type="submit" disabled={accountSubmitting}>
                {accountSubmitting && <Spinner size="sm" onDark />}
                {accountSubmitting ? "Creating account..." : "Continue"}
              </button>
            </form>
            <p className="auth-switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
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

          {profile && step === "learning" && (
            <LdInterventionSection
              items={profile.ldInterventions}
              onChange={(ldInterventions) => setProfile({ ...profile, ldInterventions })}
              documents={documents}
              onDocumentsChange={setDocuments}
            />
          )}

          {profile && step === "awards" && (
            <AwardsSection
              items={profile.awards}
              onChange={(awards) => setProfile({ ...profile, awards })}
              documents={documents}
              onDocumentsChange={setDocuments}
            />
          )}

          {profile && step === "documents" && <DocumentsSection items={documents} onChange={setDocuments} />}

          {profile && step === "learning" && ldEntriesMissingProof.length > 0 && (
            <div className="field-warning">
              <p>Upload proof for the following entries before continuing:</p>
              <ul>
                {ldEntriesMissingProof.map((entry) => (
                  <li key={entry.id}>"{entry.title}"</li>
                ))}
              </ul>
            </div>
          )}

          {profile && step === "awards" && awardsMissingProof.length > 0 && (
            <div className="field-warning">
              <p>Upload proof for the following awards before continuing:</p>
              <ul>
                {awardsMissingProof.map((award) => (
                  <li key={award.id}>"{award.title}"</li>
                ))}
              </ul>
            </div>
          )}

          {profile && isLastStep && missingRequiredDocuments && (
            <div className="field-warning">
              <p>Upload the following required document(s) before finishing registration:</p>
              <ul>
                {missingPds && <li>Personal Data Sheet (PDS) — PDF copy</li>}
                {missingPdsExcel && <li>Personal Data Sheet (PDS) — Excel (CS Form 212) copy</li>}
                {missingEligibilityProof && (
                  <li>Certificate of Eligibility / Rating / License (you indicated you have a civil service eligibility)</li>
                )}
                {ldEntriesMissingProof.map((entry) => (
                  <li key={entry.id}>Proof for Learning & Development entry "{entry.title}" (in Learning & Development)</li>
                ))}
                {awardsMissingProof.map((award) => (
                  <li key={award.id}>Proof for award "{award.title}" (in Awards)</li>
                ))}
              </ul>
            </div>
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
                <button type="button" onClick={handleFinish} disabled={finishSubmitting || missingRequiredDocuments}>
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
                  disabled={nextBlockedOnCurrentStep}
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
