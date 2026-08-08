import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
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
  const toast = useToast();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateJobPostingInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<JobPostingStatus>("OPEN");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JobPosting | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    listJobPostings()
      .then(setPostings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CreateJobPostingInput>(key: K, value: CreateJobPostingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
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
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateJobPosting(editingId, { ...form, status: editingStatus });
        setPostings((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success(`"${updated.title}" was updated.`);
      } else {
        const created = await createJobPosting(form);
        setPostings((prev) => [created, ...prev]);
        toast.success(`"${created.title}" was posted. Applications close ${new Date(created.closingAt).toLocaleString()}.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save job posting");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteJobPosting(pendingDelete.id);
      setPostings((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      toast.success(`"${pendingDelete.title}" was deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete job posting");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Job Management</h1>
        <button type="button" onClick={openAddModal}>
          Add Job
        </button>
      </div>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
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
              {postings.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No job postings yet.
                  </td>
                </tr>
              )}
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
                      <button type="button" className="danger" onClick={() => setPendingDelete(posting)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? "Edit job posting" : "Add job posting"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="job-posting-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update job" : "Post job"}
            </button>
          </>
        }
      >
        {!editingId && <p>Applications automatically close 10 days after posting, at 11:59:59 PM.</p>}
        <form id="job-posting-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.title ? "field has-error" : "field"}>
            <label htmlFor="title" className="required">
              Title
            </label>
            <input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} />
            <FieldError message={fieldErrors.title} />
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
          <div className={fieldErrors.qualificationEducation ? "field has-error" : "field"}>
            <label htmlFor="qualificationEducation" className="required">
              Qualification standard - Education
            </label>
            <textarea
              id="qualificationEducation"
              required
              value={form.qualificationEducation}
              onChange={(e) => update("qualificationEducation", e.target.value)}
            />
            <FieldError message={fieldErrors.qualificationEducation} />
          </div>
          <div className={fieldErrors.qualificationTraining ? "field has-error" : "field"}>
            <label htmlFor="qualificationTraining" className="required">
              Qualification standard - Training
            </label>
            <textarea
              id="qualificationTraining"
              required
              value={form.qualificationTraining}
              onChange={(e) => update("qualificationTraining", e.target.value)}
            />
            <FieldError message={fieldErrors.qualificationTraining} />
          </div>
          <div className={fieldErrors.qualificationExperience ? "field has-error" : "field"}>
            <label htmlFor="qualificationExperience" className="required">
              Qualification standard - Experience
            </label>
            <textarea
              id="qualificationExperience"
              required
              value={form.qualificationExperience}
              onChange={(e) => update("qualificationExperience", e.target.value)}
            />
            <FieldError message={fieldErrors.qualificationExperience} />
          </div>
          <div className={fieldErrors.qualificationEligibility ? "field has-error" : "field"}>
            <label htmlFor="qualificationEligibility" className="required">
              Qualification standard - Eligibility
            </label>
            <textarea
              id="qualificationEligibility"
              required
              value={form.qualificationEligibility}
              onChange={(e) => update("qualificationEligibility", e.target.value)}
            />
            <FieldError message={fieldErrors.qualificationEligibility} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete job posting?"
        description={
          <>
            <strong>{pendingDelete?.title}</strong> will be permanently deleted. This can't be undone, and is
            blocked if the posting already has submitted applications.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
