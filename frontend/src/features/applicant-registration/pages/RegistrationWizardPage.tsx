import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { getMyProfile } from "../api/applicantsApi";
import { listMyDocuments } from "../api/documentsApi";
import { DemographicProfileForm } from "../components/DemographicProfileForm";
import { WorkExperienceSection } from "../components/WorkExperienceSection";
import { LdInterventionSection } from "../components/LdInterventionSection";
import { AwardsSection } from "../components/AwardsSection";
import { DocumentsSection } from "../components/DocumentsSection";
import type { ApplicantDocument, ApplicantProfile } from "../types";

type Step = "profile" | "experience" | "learning" | "awards" | "documents";

const STEPS: { id: Step; label: string }[] = [
  { id: "profile", label: "1. Demographic Profile" },
  { id: "experience", label: "2. Work Experience" },
  { id: "learning", label: "3. Learning & Development" },
  { id: "awards", label: "4. Awards" },
  { id: "documents", label: "5. Documents" },
];

export function RegistrationWizardPage() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyProfile(), listMyDocuments().catch(() => [])])
      .then(([loadedProfile, loadedDocuments]) => {
        setProfile(loadedProfile);
        setDocuments(loadedDocuments);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your profile"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading your profile...</p>;

  return (
    <div>
      <h1>Applicant Registration</h1>
      <ErrorBanner message={error} />

      {!profile && (
        <p>
          Start by filling in your demographic profile below. The remaining sections unlock once your profile is
          created.
        </p>
      )}

      {profile && (
        <div className="wizard-steps">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={step === s.id ? "active" : ""}
              onClick={() => setStep(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {(!profile || step === "profile") && <DemographicProfileForm profile={profile} onSaved={setProfile} />}

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
    </div>
  );
}
