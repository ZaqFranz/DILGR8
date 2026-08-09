import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { ELIGIBILITY_LABELS } from "@/shared/constants/eligibility";
import { listJobPostings } from "../api/jobPostingsApi";
import type { JobPosting } from "../types";
import { submitApplication } from "@/features/applicant-registration/api/applicationsApi";
import { getMyProfile } from "@/features/applicant-registration/api/applicantsApi";
import type { ApplicantProfile } from "@/features/applicant-registration/types";

function isAcceptingApplications(posting: JobPosting): boolean {
  return posting.status === "OPEN" && new Date(posting.closingAt).getTime() >= Date.now();
}

function meetsEligibility(posting: JobPosting, profile: ApplicantProfile | null): boolean {
  if (posting.requiredEligibilityTypes.length === 0) return true;
  if (!profile || !profile.hasEligibility) return false;
  return posting.requiredEligibilityTypes.includes(profile.eligibilityType);
}

function requiredEligibilityText(posting: JobPosting): string {
  return posting.requiredEligibilityTypes.map((type) => ELIGIBILITY_LABELS[type]).join(", ");
}

export function JobPostingsListPage() {
  const toast = useToast();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [detailsPosting, setDetailsPosting] = useState<JobPosting | null>(null);

  useEffect(() => {
    Promise.all([listJobPostings(), getMyProfile()])
      .then(([fetchedPostings, fetchedProfile]) => {
        setPostings(fetchedPostings);
        setProfile(fetchedProfile);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleApply(posting: JobPosting) {
    setError(null);
    setApplyingId(posting.id);
    try {
      await submitApplication(posting.id);
      toast.success(`Application submitted for "${posting.title}".`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit application");
    } finally {
      setApplyingId(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading job postings..." />;

  return (
    <div>
      <h1>Job Postings</h1>
      <ErrorBanner message={error} />
      {postings.length === 0 && <p>No job postings available right now.</p>}
      {postings.map((posting) => {
        const acceptingApplications = isAcceptingApplications(posting);
        const eligible = meetsEligibility(posting, profile);
        const canApply = acceptingApplications && eligible;
        return (
          <div className="card" key={posting.id}>
            <h2>
              {posting.title}{" "}
              <span className={`badge ${posting.status === "OPEN" ? "open" : "closed"}`}>{posting.status}</span>
            </h2>
            <dl className="posting-meta">
              <dt>Level</dt>
              <dd>{posting.positionLevel === "PROMOTIONAL" ? "Promotional" : "Entry level"}</dd>
              <dt>Monthly salary</dt>
              <dd>{posting.monthlySalary}</dd>
              <dt>Applications close</dt>
              <dd>{new Date(posting.closingAt).toLocaleString()}</dd>
            </dl>
            {acceptingApplications && !eligible && (
              <p className="field-warning">
                Requires eligibility: {requiredEligibilityText(posting)}. Update your eligibility on your profile to
                apply.
              </p>
            )}
            <div className="actions-row">
              <button type="button" className="secondary" onClick={() => setDetailsPosting(posting)}>
                View Details
              </button>
              <button
                type="button"
                disabled={!canApply || applyingId === posting.id}
                onClick={() => handleApply(posting)}
              >
                {applyingId === posting.id && <Spinner size="sm" onDark />}
                {applyingId === posting.id
                  ? "Submitting..."
                  : !acceptingApplications
                    ? "Applications closed"
                    : !eligible
                      ? "Not eligible"
                      : "Apply"}
              </button>
            </div>
          </div>
        );
      })}

      <Modal
        open={detailsPosting !== null}
        title={detailsPosting?.title ?? ""}
        onClose={() => setDetailsPosting(null)}
        footer={
          <button type="button" className="secondary" onClick={() => setDetailsPosting(null)}>
            Close
          </button>
        }
      >
        {detailsPosting && (
          <>
            <span className={`badge ${detailsPosting.status === "OPEN" ? "open" : "closed"}`}>
              {detailsPosting.status}
            </span>
            <p style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>{detailsPosting.description}</p>
            <dl className="posting-meta">
              <dt>Level</dt>
              <dd>{detailsPosting.positionLevel === "PROMOTIONAL" ? "Promotional" : "Entry level"}</dd>
              <dt>Monthly salary</dt>
              <dd>{detailsPosting.monthlySalary}</dd>
              <dt>Place of assignment</dt>
              <dd>{detailsPosting.placeOfAssignment}</dd>
              <dt>Education</dt>
              <dd>{detailsPosting.qualificationEducation}</dd>
              <dt>Training</dt>
              <dd>{detailsPosting.qualificationTraining}</dd>
              <dt>Experience</dt>
              <dd>{detailsPosting.qualificationExperience}</dd>
              <dt>Eligibility</dt>
              <dd>{detailsPosting.qualificationEligibility}</dd>
              <dt>Required eligibility</dt>
              <dd>
                {detailsPosting.requiredEligibilityTypes.length > 0
                  ? requiredEligibilityText(detailsPosting)
                  : "None required"}
              </dd>
              <dt>Applications close</dt>
              <dd>{new Date(detailsPosting.closingAt).toLocaleString()}</dd>
            </dl>
            {detailsPosting.requiredEligibilityTypes.length > 0 && !meetsEligibility(detailsPosting, profile) && (
              <p className="field-warning">
                You don't currently qualify for this posting's eligibility requirement.
              </p>
            )}
            <h3 style={{ marginTop: "1rem" }}>Duties and Responsibilities</h3>
            <ol className="posting-duties">
              {detailsPosting.duties
                .split("\n")
                .map((duty) => duty.trim())
                .filter((duty) => duty.length > 0)
                .map((duty, index) => (
                  <li key={index}>{duty}</li>
                ))}
            </ol>
            {detailsPosting.positionLevel === "PROMOTIONAL" && (
              <p>
                <em>
                  Promotional applications require an uploaded IPCR and Designation to a Higher Position document
                  on your profile before you apply.
                </em>
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
