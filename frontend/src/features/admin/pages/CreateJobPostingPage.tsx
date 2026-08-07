import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { createJobPosting, listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { CreateJobPostingInput, JobPosting, PositionLevel } from "@/features/job-postings/types";

const emptyForm: CreateJobPostingInput = {
  title: "",
  positionLevel: "ENTRY",
  qualificationEducation: "",
  qualificationTraining: "",
  qualificationExperience: "",
  qualificationEligibility: "",
};

export function CreateJobPostingPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateJobPostingInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadPostings() {
    return listJobPostings()
      .then(setPostings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"));
  }

  useEffect(() => {
    loadPostings().finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CreateJobPostingInput>(key: K, value: CreateJobPostingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const created = await createJobPosting(form);
      setPostings((prev) => [created, ...prev]);
      setForm(emptyForm);
      setMessage(`"${created.title}" was posted. Applications close ${new Date(created.closingAt).toLocaleString()}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create job posting");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Post a Job</h1>
      <ErrorBanner message={error} />
      {message && <div className="card">{message}</div>}

      <div className="card">
        <h2>New job posting</h2>
        <p>Applications automatically close 10 days after posting, at 11:59:59 PM.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="positionLevel">Position level</label>
            <select
              id="positionLevel"
              value={form.positionLevel}
              onChange={(e) => update("positionLevel", e.target.value as PositionLevel)}
            >
              <option value="ENTRY">Entry level</option>
              <option value="PROMOTIONAL">Promotional</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="qualificationEducation">Qualification standard - Education</label>
            <textarea
              id="qualificationEducation"
              required
              value={form.qualificationEducation}
              onChange={(e) => update("qualificationEducation", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="qualificationTraining">Qualification standard - Training</label>
            <textarea
              id="qualificationTraining"
              required
              value={form.qualificationTraining}
              onChange={(e) => update("qualificationTraining", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="qualificationExperience">Qualification standard - Experience</label>
            <textarea
              id="qualificationExperience"
              required
              value={form.qualificationExperience}
              onChange={(e) => update("qualificationExperience", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="qualificationEligibility">Qualification standard - Eligibility</label>
            <textarea
              id="qualificationEligibility"
              required
              value={form.qualificationEligibility}
              onChange={(e) => update("qualificationEligibility", e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Posting..." : "Post job"}
          </button>
        </form>
      </div>

      <h2>Existing postings</h2>
      {loading && <p>Loading...</p>}
      {!loading && postings.length === 0 && <p>No job postings yet.</p>}
      {postings.map((posting) => (
        <div className="card" key={posting.id}>
          <h3>
            {posting.title} <span className={`badge ${posting.status === "OPEN" ? "open" : "closed"}`}>{posting.status}</span>
          </h3>
          <p>
            <strong>Level:</strong> {posting.positionLevel === "PROMOTIONAL" ? "Promotional" : "Entry level"} &nbsp;
            <strong>Closes:</strong> {new Date(posting.closingAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
