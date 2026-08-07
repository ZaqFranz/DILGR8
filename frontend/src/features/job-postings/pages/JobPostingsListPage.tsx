import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { listJobPostings } from "../api/jobPostingsApi";
import type { JobPosting } from "../types";
import { submitApplication } from "@/features/applicant-registration/api/applicationsApi";

function isAcceptingApplications(posting: JobPosting): boolean {
  return posting.status === "OPEN" && new Date(posting.closingAt).getTime() >= Date.now();
}

export function JobPostingsListPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listJobPostings()
      .then(setPostings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleApply(posting: JobPosting) {
    setError(null);
    setMessage(null);
    setApplyingId(posting.id);
    try {
      await submitApplication(posting.id);
      setMessage(`Application submitted for "${posting.title}".`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit application");
    } finally {
      setApplyingId(null);
    }
  }

  if (loading) return <p>Loading job postings...</p>;

  return (
    <div>
      <h1>Job Postings</h1>
      <ErrorBanner message={error} />
      {message && <div className="card">{message}</div>}
      {postings.length === 0 && <p>No job postings available right now.</p>}
      {postings.map((posting) => {
        const acceptingApplications = isAcceptingApplications(posting);
        return (
          <div className="card" key={posting.id}>
            <h2>
              {posting.title}{" "}
              <span className={`badge ${posting.status === "OPEN" ? "open" : "closed"}`}>{posting.status}</span>
            </h2>
            <p>
              <strong>Level:</strong> {posting.positionLevel === "PROMOTIONAL" ? "Promotional" : "Entry level"}
            </p>
            <p>
              <strong>Education:</strong> {posting.qualificationEducation}
            </p>
            <p>
              <strong>Training:</strong> {posting.qualificationTraining}
            </p>
            <p>
              <strong>Experience:</strong> {posting.qualificationExperience}
            </p>
            <p>
              <strong>Eligibility:</strong> {posting.qualificationEligibility}
            </p>
            <p>
              <strong>Applications close:</strong> {new Date(posting.closingAt).toLocaleString()}
            </p>
            {posting.positionLevel === "PROMOTIONAL" && (
              <p>
                <em>Promotional applications require an uploaded IPCR and Designation to a Higher Position
                document on your profile before you apply.</em>
              </p>
            )}
            <button type="button" disabled={!acceptingApplications || applyingId === posting.id} onClick={() => handleApply(posting)}>
              {applyingId === posting.id
                ? "Submitting..."
                : acceptingApplications
                  ? "Apply"
                  : "Applications closed"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
