import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { usePagination } from "@/shared/utils/usePagination";
import { AdminShell } from "../components/AdminShell";
import {
  createEvaluationCriterion,
  deleteEvaluationCriterion,
  listEvaluationCriteria,
  updateEvaluationCriterion,
} from "../api/evaluationCriteriaApi";
import type { CreateEvaluationCriterionInput, EvaluationCriterion } from "../types";

const emptyForm: CreateEvaluationCriterionInput = { name: "", maxScore: 25 };

export function EvaluationCriteriaPage() {
  const toast = useToast();
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateEvaluationCriterionInput>(emptyForm);
  const [questionInputs, setQuestionInputs] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EvaluationCriterion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingQuestionsFor, setViewingQuestionsFor] = useState<EvaluationCriterion | null>(null);
  const pagination = usePagination(criteria, 10);

  useEffect(() => {
    listEvaluationCriteria()
      .then(setCriteria)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load evaluation criteria"))
      .finally(() => setLoading(false));
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setQuestionInputs([]);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(criterion: EvaluationCriterion) {
    setEditingId(criterion.id);
    setEditingActive(criterion.isActive);
    setForm({ name: criterion.name, maxScore: criterion.maxScore, sortOrder: criterion.sortOrder });
    setQuestionInputs(criterion.questions.map((q) => q.text));
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setQuestionInputs([]);
    setFieldErrors({});
  }

  function addQuestionInput() {
    setQuestionInputs((prev) => [...prev, ""]);
  }

  function updateQuestionInput(index: number, value: string) {
    setQuestionInputs((prev) => prev.map((q, i) => (i === index ? value : q)));
  }

  function removeQuestionInput(index: number) {
    setQuestionInputs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const questions = questionInputs.map((q) => q.trim()).filter((q) => q.length > 0);
      const payload = { ...form, questions };
      if (editingId) {
        const updated = await updateEvaluationCriterion(editingId, { ...payload, isActive: editingActive });
        setCriteria((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success(`"${updated.name}" was updated.`);
      } else {
        const created = await createEvaluationCriterion(payload);
        setCriteria((prev) => [...prev, created]);
        toast.success(`"${created.name}" was added to the interview rubric.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setQuestionInputs([]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save evaluation criterion");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteEvaluationCriterion(pendingDelete.id);
      setCriteria((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      toast.success(`"${pendingDelete.name}" was deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete evaluation criterion");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Evaluation Criteria</h1>
        <button type="button" onClick={openAddModal}>
          Add Criterion
        </button>
      </div>
      <p>
        The interview rubric panel members score applicants against. A criterion with recorded scores can&apos;t be
        deleted - deactivate it instead so past scores stay intact.
      </p>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Max score</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {criteria.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No evaluation criteria yet.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((criterion) => (
                <tr key={criterion.id}>
                  <td>{criterion.name}</td>
                  <td>{criterion.maxScore}</td>
                  <td>
                    <span className={`badge ${criterion.isActive ? "open" : "closed"}`}>
                      {criterion.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button type="button" className="secondary" onClick={() => setViewingQuestionsFor(criterion)}>
                        View Questions
                      </button>
                      <button type="button" className="secondary" onClick={() => startEdit(criterion)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => setPendingDelete(criterion)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={10}
            onPageChange={pagination.setPage}
          />
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? "Edit criterion" : "Add criterion"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="criterion-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update criterion" : "Add criterion"}
            </button>
          </>
        }
      >
        <form id="criterion-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.name ? "field has-error" : "field"}>
            <label htmlFor="name" className="required">
              Name
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FieldError message={fieldErrors.name} />
          </div>
          <div className={fieldErrors.questions ? "field has-error" : "field"}>
            <label>Questions (optional)</label>
            <p className="field-hint">Shown to panel members alongside this criterion's score box when they evaluate an applicant.</p>
            {questionInputs.map((question, index) => (
              <div key={index} className="data-table-actions" style={{ marginBottom: "0.5rem" }}>
                <input
                  aria-label={`Question ${index + 1}`}
                  placeholder="e.g. Ask the applicant to describe a challenging situation they've handled at work"
                  value={question}
                  onChange={(e) => updateQuestionInput(index, e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="danger" onClick={() => removeQuestionInput(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addQuestionInput}>
              Add Question
            </button>
            <FieldError message={fieldErrors.questions} />
          </div>
          <div className={fieldErrors.maxScore ? "field has-error" : "field"}>
            <label htmlFor="maxScore" className="required">
              Max score
            </label>
            <input
              id="maxScore"
              type="number"
              min={1}
              required
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })}
            />
            <FieldError message={fieldErrors.maxScore} />
          </div>
          {editingId && (
            <div className="field">
              <label htmlFor="isActive">Status</label>
              <select
                id="isActive"
                value={editingActive ? "active" : "inactive"}
                onChange={(e) => setEditingActive(e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={viewingQuestionsFor !== null}
        title={`Questions — ${viewingQuestionsFor?.name ?? ""}`}
        onClose={() => setViewingQuestionsFor(null)}
        footer={
          <button type="button" className="secondary" onClick={() => setViewingQuestionsFor(null)}>
            Close
          </button>
        }
      >
        {viewingQuestionsFor && viewingQuestionsFor.questions.length === 0 && (
          <p>No questions have been added for this criterion yet.</p>
        )}
        {viewingQuestionsFor && viewingQuestionsFor.questions.length > 0 && (
          <ol>
            {viewingQuestionsFor.questions.map((question) => (
              <li key={question.id} style={{ marginBottom: "0.5rem" }}>
                {question.text}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete criterion?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be permanently deleted. This can&apos;t be undone, and is
            blocked if the criterion already has recorded scores.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
