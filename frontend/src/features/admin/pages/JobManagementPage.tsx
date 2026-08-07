import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { InlineConfirmButton } from "@/shared/components/InlineConfirmButton";
import { AdminShell } from "../components/AdminShell";
import {
  createJobPosting,
  deleteJobPosting,
  listJobPostings,
  updateJobPosting,
} from "@/features/job-postings/api/jobPostingsApi";
import type { CreateJobPostingInput, JobPosting, JobPostingStatus, PositionLevel } from "@/features/job-postings/types";

const emptyForm: CreateJobPostingInput = {
  title: "",
  positionLevel: "ENTRY",
  qualificationEducation: "",
  qualificationTraining: "",
  qualificationExperience: "",
  qualificationEligibility: "",
};

export function JobManagementPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateJobPostingInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<JobPostingStatus>("OPEN");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listJobPostings()
      .then(setPostings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CreateJobPostingInput>(key: K, value: CreateJobPostingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(posting: JobPosting) {
    setEditingId(posting.id);
    setEditingStatus(posting.status);
    setForm({
      title: posting.title,
      positionLevel: posting.positionLevel,
      qualificationEducation: posting.qualificationEducation,
      qualificationTraining: posting.qualificationTraining,
      qualificationExperience: posting.qualificationExperience,
      qualificationEligibility: posting.qualificationEligibility,
    });
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateJobPosting(editingId, { ...form, status: editingStatus });
        setPostings((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        setMessage(`"${updated.title}" was updated.`);
        setEditingId(null);
        setForm(emptyForm);
      } else {
        const created = await createJobPosting(form);
        setPostings((prev) => [created, ...prev]);
        setMessage(`"${created.title}" was posted. Applications close ${new Date(created.closingAt).toLocaleString()}.`);
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save job posting");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteJobPosting(id);
      setPostings((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete job posting");
    }
  }

  return (
    <AdminShell>
      <h1>Job Management</h1>
      <ErrorBanner message={error} />
      {message && <div className="card">{message}</div>}

      <div className="card">
        <h2>{editingId ? "Edit job posting" : "New job posting"}</h2>
        {!editingId && <p>Applications automatically close 10 days after posting, at 11:59:59 PM.</p>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="field-grid">
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
            {editingId && (
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" value={editingStatus} onChange={(e) => setEditingStatus(e.target.value as JobPostingStatus)}>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            )}
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
          <div className="actions-row">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update job" : "Post job"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <h2>Existing postings</h2>
      {loading && <p>Loading...</p>}
      {!loading && postings.length === 0 && <p>No job postings yet.</p>}
      {!loading && postings.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Level</th>
              <th>Status</th>
              <th>Closes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {postings.map((posting) => (
              <tr key={posting.id}>
                <td>{posting.title}</td>
                <td>{posting.positionLevel === "PROMOTIONAL" ? "Promotional" : "Entry level"}</td>
                <td>
                  <span className={`badge ${posting.status === "OPEN" ? "open" : "closed"}`}>{posting.status}</span>
                </td>
                <td>{new Date(posting.closingAt).toLocaleString()}</td>
                <td>
                  <div className="data-table-actions">
                    <button type="button" className="secondary" onClick={() => startEdit(posting)}>
                      Edit
                    </button>
                    <InlineConfirmButton onConfirm={() => handleDelete(posting.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
