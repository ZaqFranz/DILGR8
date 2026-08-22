import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { EDUCATION_LEVEL_OPTIONS } from "@/shared/constants/educationLevels";
import { ELIGIBILITY_LABELS } from "@/shared/constants/eligibility";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import {
  createHistoricalHiringRecord,
  deleteHistoricalHiringRecord,
  listHistoricalHiringRecords,
  updateHistoricalHiringRecord,
} from "../api/historicalHiringDataApi";
import type { CreateHistoricalHiringRecordInput, HistoricalHiringRecord } from "../types";
import type { EligibilityType } from "@/features/applicant-registration/types";

// Historical records realistically include people hired with no formal
// eligibility - unlike the applicant-registration form (which only offers
// the two real CSC levels since it's asking "what do you currently hold"),
// this needs to represent every real outcome honestly.
const ELIGIBILITY_SELECT_OPTIONS: { value: EligibilityType; label: string }[] = [
  { value: "NONE", label: ELIGIBILITY_LABELS.NONE },
  { value: "CSC_SUBPROFESSIONAL", label: ELIGIBILITY_LABELS.CSC_SUBPROFESSIONAL },
  { value: "CSC_PROFESSIONAL", label: ELIGIBILITY_LABELS.CSC_PROFESSIONAL },
];

const emptyForm: CreateHistoricalHiringRecordInput = {
  course: "",
  educationLevel: "BACHELORS",
  yearsOfExperience: 0,
  previousJobTitle: "",
  eligibilityType: "NONE",
  year: new Date().getFullYear(),
  wasHired: true,
  sourceNote: "",
  awards: [],
  ldEntries: [],
};

// Deliberately not wrapped in AdminShell and not linked from anywhere in
// the app - see requireOwner (backend) and docs/decisions.md. Only reached
// by typing its exact URL, and the backend still rejects every account
// except the one configured as HISTORICAL_DATA_OWNER_EMAIL regardless.
export function HistoricalHiringDataPage() {
  const toast = useToast();
  const [records, setRecords] = useState<HistoricalHiringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateHistoricalHiringRecordInput>(emptyForm);
  const [awardTitle, setAwardTitle] = useState("");
  const [ldTitle, setLdTitle] = useState("");
  const [ldHours, setLdHours] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HistoricalHiringRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    listHistoricalHiringRecords()
      .then(setRecords)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load historical records"))
      .finally(() => setLoading(false));
  }, []);

  function resetFormState() {
    setForm(emptyForm);
    setAwardTitle("");
    setLdTitle("");
    setLdHours("");
  }

  function openAddModal() {
    setEditingId(null);
    resetFormState();
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(record: HistoricalHiringRecord) {
    setEditingId(record.id);
    setForm({
      course: record.course,
      educationLevel: record.educationLevel,
      yearsOfExperience: record.yearsOfExperience,
      previousJobTitle: record.previousJobTitle,
      eligibilityType: record.eligibilityType,
      year: record.year,
      wasHired: record.wasHired,
      sourceNote: record.sourceNote ?? "",
      awards: record.awards.map((a) => ({ title: a.title })),
      ldEntries: record.ldEntries.map((l) => ({ title: l.title, hours: l.hours })),
    });
    setAwardTitle("");
    setLdTitle("");
    setLdHours("");
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    resetFormState();
    setFieldErrors({});
  }

  function addAwardEntry() {
    if (!awardTitle.trim()) return;
    setForm((prev) => ({ ...prev, awards: [...prev.awards, { title: awardTitle.trim() }] }));
    setAwardTitle("");
  }

  function removeAwardEntry(index: number) {
    setForm((prev) => ({ ...prev, awards: prev.awards.filter((_, i) => i !== index) }));
  }

  function addLdEntry() {
    const hours = Number(ldHours);
    if (!ldTitle.trim() || !hours || hours <= 0) return;
    setForm((prev) => ({ ...prev, ldEntries: [...prev.ldEntries, { title: ldTitle.trim(), hours }] }));
    setLdTitle("");
    setLdHours("");
  }

  function removeLdEntry(index: number) {
    setForm((prev) => ({ ...prev, ldEntries: prev.ldEntries.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateHistoricalHiringRecord(editingId, form);
        setRecords((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        toast.success("Historical record updated.");
      } else {
        const created = await createHistoricalHiringRecord(form);
        setRecords((prev) => [created, ...prev]);
        toast.success("Historical record added.");
      }
      setModalOpen(false);
      setEditingId(null);
      resetFormState();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save historical record");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteHistoricalHiringRecord(pendingDelete.id);
      setRecords((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      toast.success("Historical record deleted.");
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete historical record");
    }
  }

  return (
    <div className="centered-page" style={{ maxWidth: "84rem" }}>
      <div className="page-header">
        <h1>Historical Hiring Data</h1>
        <button type="button" onClick={openAddModal}>
          Add Record
        </button>
      </div>
      <p>
        Training data for the Evaluate Applicants hire-likelihood percentage - transcribed from DILG&apos;s own past
        records, not tied to any real applicant. Every field is real, factual data; the model learns from the actual
        Hired/Not Hired outcome, not a subjective score.
      </p>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Education Level</th>
                <th>Years of Exp.</th>
                <th>Previous Job</th>
                <th>Eligibility</th>
                <th>Awards</th>
                <th>L&amp;D</th>
                <th>Year</th>
                <th>Status</th>
                <th>Source Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty">
                    No historical records yet.
                  </td>
                </tr>
              )}
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.course}</td>
                  <td>{record.educationLevel}</td>
                  <td>{record.yearsOfExperience}</td>
                  <td>{record.previousJobTitle}</td>
                  <td>{ELIGIBILITY_LABELS[record.eligibilityType]}</td>
                  <td>{record.awards.length > 0 ? record.awards.map((a) => a.title).join(", ") : "-"}</td>
                  <td>
                    {record.ldEntries.length > 0
                      ? record.ldEntries.map((l) => `${l.title} (${l.hours}h)`).join(", ")
                      : "-"}
                  </td>
                  <td>{record.year}</td>
                  <td>
                    <span className={`badge ${record.wasHired ? "qualified" : "rejected"}`}>
                      {record.wasHired ? "Hired" : "Not Hired"}
                    </span>
                  </td>
                  <td>{record.sourceNote ?? "-"}</td>
                  <td>
                    <div className="data-table-actions">
                      <button type="button" className="secondary" onClick={() => startEdit(record)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => setPendingDelete(record)}>
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
        title={editingId ? "Edit historical record" : "Add historical record"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="historical-record-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update record" : "Add record"}
            </button>
          </>
        }
      >
        <form id="historical-record-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.course ? "field has-error" : "field"}>
            <label htmlFor="course" className="required">
              Course
            </label>
            <input
              id="course"
              required
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              placeholder='e.g. "BS Public Administration"'
            />
            <FieldError message={fieldErrors.course} />
          </div>
          <div className={fieldErrors.educationLevel ? "field has-error" : "field"}>
            <label htmlFor="educationLevel" className="required">
              Education Level
            </label>
            <select
              id="educationLevel"
              value={form.educationLevel}
              onChange={(e) => setForm({ ...form, educationLevel: e.target.value as CreateHistoricalHiringRecordInput["educationLevel"] })}
            >
              {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.educationLevel} />
          </div>
          <div className={fieldErrors.yearsOfExperience ? "field has-error" : "field"}>
            <label htmlFor="yearsOfExperience" className="required">
              Years of Experience
            </label>
            <input
              id="yearsOfExperience"
              type="number"
              min={0}
              max={60}
              required
              value={form.yearsOfExperience}
              onChange={(e) => setForm({ ...form, yearsOfExperience: Number(e.target.value) })}
            />
            <FieldError message={fieldErrors.yearsOfExperience} />
          </div>
          <div className={fieldErrors.previousJobTitle ? "field has-error" : "field"}>
            <label htmlFor="previousJobTitle" className="required">
              Specific Job (that the years of experience above is for)
            </label>
            <input
              id="previousJobTitle"
              required
              value={form.previousJobTitle}
              onChange={(e) => setForm({ ...form, previousJobTitle: e.target.value })}
              placeholder='e.g. "Administrative Assistant II"'
            />
            <FieldError message={fieldErrors.previousJobTitle} />
          </div>
          <div className="field">
            <label htmlFor="eligibilityType">Eligibility</label>
            <select
              id="eligibilityType"
              value={form.eligibilityType}
              onChange={(e) => setForm({ ...form, eligibilityType: e.target.value as EligibilityType })}
            >
              {ELIGIBILITY_SELECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Awards</label>
            {form.awards.length > 0 && (
              <ul>
                {form.awards.map((award, i) => (
                  <li key={i} className="proof-item">
                    <span>{award.title}</span>
                    <button type="button" className="danger" onClick={() => removeAwardEntry(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="field-grid">
              <input
                value={awardTitle}
                onChange={(e) => setAwardTitle(e.target.value)}
                placeholder="Award title"
              />
              <button type="button" className="secondary" onClick={addAwardEntry}>
                Add Award
              </button>
            </div>
          </div>

          <div className="field">
            <label>Learning &amp; Development</label>
            {form.ldEntries.length > 0 && (
              <ul>
                {form.ldEntries.map((entry, i) => (
                  <li key={i} className="proof-item">
                    <span>
                      {entry.title} ({entry.hours}h)
                    </span>
                    <button type="button" className="danger" onClick={() => removeLdEntry(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="field-grid">
              <input value={ldTitle} onChange={(e) => setLdTitle(e.target.value)} placeholder="Training title" />
              <input
                type="number"
                min={1}
                value={ldHours}
                onChange={(e) => setLdHours(e.target.value)}
                placeholder="Hours"
              />
              <button type="button" className="secondary" onClick={addLdEntry}>
                Add Training
              </button>
            </div>
          </div>

          <div className={fieldErrors.year ? "field has-error" : "field"}>
            <label htmlFor="year" className="required">
              Year
            </label>
            <input
              id="year"
              type="number"
              min={1900}
              max={2100}
              required
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
            <FieldError message={fieldErrors.year} />
          </div>
          <div className="field">
            <label htmlFor="wasHired" className="required">
              Status
            </label>
            <select
              id="wasHired"
              value={form.wasHired ? "hired" : "not-hired"}
              onChange={(e) => setForm({ ...form, wasHired: e.target.value === "hired" })}
            >
              <option value="hired">Hired</option>
              <option value="not-hired">Not Hired</option>
            </select>
          </div>
          <div className={fieldErrors.sourceNote ? "field has-error" : "field"}>
            <label htmlFor="sourceNote">Source Note (optional)</label>
            <input
              id="sourceNote"
              value={form.sourceNote ?? ""}
              onChange={(e) => setForm({ ...form, sourceNote: e.target.value })}
              placeholder='e.g. "2019 batch, Regional Office records"'
            />
            <FieldError message={fieldErrors.sourceNote} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete record?"
        description="This historical record will be permanently deleted. This can't be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
