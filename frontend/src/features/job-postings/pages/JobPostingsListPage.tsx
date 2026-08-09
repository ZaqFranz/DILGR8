import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { ELIGIBILITY_LABELS } from "@/shared/constants/eligibility";
import { listJobPostings } from "../api/jobPostingsApi";
import type { JobPosting } from "../types";
import { listMyApplications, submitApplication } from "@/features/applicant-registration/api/applicationsApi";
import { getMyProfile } from "@/features/applicant-registration/api/applicantsApi";
import type { ApplicantProfile } from "@/features/applicant-registration/types";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const APPLICATION_LETTER_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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
  const [appliedJobPostingIds, setAppliedJobPostingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsPosting, setDetailsPosting] = useState<JobPosting | null>(null);

  // The Application Letter is addressed to a specific vacancy, so it's
  // attached here as part of applying rather than once at registration -
  // applying is now a small form (pick a file, confirm) instead of a single
  // click, hence its own modal state separate from detailsPosting above.
  const [applyPosting, setApplyPosting] = useState<JobPosting | null>(null);
  const [applyFile, setApplyFile] = useState<File | null>(null);
  const [applyFileError, setApplyFileError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const applyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([listJobPostings(), getMyProfile(), listMyApplications()])
      .then(([fetchedPostings, fetchedProfile, fetchedApplications]) => {
        setPostings(fetchedPostings);
        setProfile(fetchedProfile);
        setAppliedJobPostingIds(new Set(fetchedApplications.map((application) => application.jobPosting.id)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  function openApplyModal(posting: JobPosting) {
    setError(null);
    setApplyFile(null);
    setApplyFileError(null);
    setApplyError(null);
    setApplyPosting(posting);
  }

  function closeApplyModal() {
    if (applySubmitting) return;
    setApplyPosting(null);
    setApplyFile(null);
    setApplyFileError(null);
    setApplyError(null);
  }

  async function handleApplySubmit(event: FormEvent) {
    event.preventDefault();
    if (!applyPosting) return;
    setApplyError(null);
    setApplyFileError(null);
    if (!applyFile) {
      setApplyFileError("Choose your Application Letter to apply.");
      return;
    }
    if (applyFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setApplyFileError("File is too large — the maximum size is 5MB.");
      return;
    }
    if (!APPLICATION_LETTER_MIME_TYPES.has(applyFile.type)) {
      setApplyFileError("This file must be a PDF, JPEG, or PNG.");
      return;
    }
    setApplySubmitting(true);
    try {
      await submitApplication(applyPosting.id, applyFile);
      toast.success(`Application submitted for "${applyPosting.title}".`);
      setAppliedJobPostingIds((prev) => new Set(prev).add(applyPosting.id));
      setApplyPosting(null);
      setApplyFile(null);
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : "Failed to submit application");
    } finally {
      setApplySubmitting(false);
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
        const alreadyApplied = appliedJobPostingIds.has(posting.id);
        const canApply = acceptingApplications && eligible && !alreadyApplied;
        return (
          <div className="card" key={posting.id}>
            <h2>
              {posting.title}{" "}
              <span className={`badge ${posting.status === "OPEN" ? "open" : "closed"}`}>{posting.status}</span>
            </h2>
            <dl className="posting-meta">
              <dt>Salary grade</dt>
              <dd>{posting.salaryGrade}</dd>
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
              <button type="button" disabled={!canApply} onClick={() => openApplyModal(posting)}>
                {alreadyApplied
                  ? "Already Applied"
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
              <dt>No. of vacant position/s</dt>
              <dd>{detailsPosting.numberOfVacantPositions}</dd>
              <dt>Plantilla number/s</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{detailsPosting.plantillaNumbers}</dd>
              <dt>Salary grade</dt>
              <dd>{detailsPosting.salaryGrade}</dd>
              <dt>Monthly salary</dt>
              <dd>{detailsPosting.monthlySalary}</dd>
              <dt>Place of assignment</dt>
              <dd>{detailsPosting.placeOfAssignment}</dd>
              <dt>Position next in rank</dt>
              <dd>{detailsPosting.positionNextInRank}</dd>
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
          </>
        )}
      </Modal>

      <Modal
        open={applyPosting !== null}
        title={`Apply: ${applyPosting?.title ?? ""}`}
        onClose={closeApplyModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={applySubmitting} onClick={closeApplyModal}>
              Cancel
            </button>
            <button type="submit" form="apply-form" disabled={applySubmitting}>
              {applySubmitting && <Spinner size="sm" onDark />}
              {applySubmitting ? "Submitting..." : "Submit application"}
            </button>
          </>
        }
      >
        <p>
          Upload your Application Letter for this position (PDF, JPEG, or PNG, max 5MB), addressed as follows:
        </p>
        <p className="field-hint" style={{ whiteSpace: "pre-line" }}>
          Addressed to:{"\n"}
          ARNEL M. AGABE, CESO III{"\n"}
          Regional Director{"\n"}
          DILG Regional Office 8{"\n"}
          Kanhuraw Hill, Tacloban City{"\n\n"}
          Thru:{"\n"}
          JANE A. VILLANUEVA{"\n"}
          LGOO V / Head, Human Resource Section
        </p>
        <ErrorBanner message={applyError} />
        <form id="apply-form" onSubmit={handleApplySubmit} noValidate>
          <div className={applyFileError ? "field has-error" : "field"}>
            <label htmlFor="apply-file" className="required">
              Application Letter
            </label>
            <input
              id="apply-file"
              ref={applyFileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => {
                setApplyFile(e.target.files?.[0] ?? null);
                setApplyFileError(null);
              }}
            />
            <FieldError message={applyFileError} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
