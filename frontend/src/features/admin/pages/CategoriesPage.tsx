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
import { ApplicantScoresModal } from "../components/ApplicantScoresModal";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../api/categoriesApi";
import type { Category, CriterionInput } from "../types";

interface CriterionRow extends CriterionInput {
  // Local-only key so React can track a still-unsaved (no `id` yet) row
  // across re-renders/reorders without using its array index.
  key: string;
}

let nextRowKey = 0;
function newRow(): CriterionRow {
  return { key: `new-${nextRowKey++}`, name: "", maxScore: 10 };
}

const emptyName = "";
const defaultWeightPercent = 25;

export function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(emptyName);
  const [weightPercent, setWeightPercent] = useState(defaultWeightPercent);
  const [criteriaRows, setCriteriaRows] = useState<CriterionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingCriteriaFor, setViewingCriteriaFor] = useState<Category | null>(null);
  const [showApplicantScores, setShowApplicantScores] = useState(false);
  const pagination = usePagination(categories, 10);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);

  const formTotal = criteriaRows.reduce((sum, c) => sum + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0);
  // Sum of every *other* active category's weight, so the form can warn if
  // adding/editing this one would push the total over (or leave it under)
  // 100% - a soft hint, not a hard gate, since the app never requires
  // weights to sum to exactly 100.
  const otherActiveWeightTotal = categories
    .filter((c) => c.isActive && c.id !== editingId)
    .reduce((sum, c) => sum + c.weightPercent, 0);
  const projectedWeightTotal = otherActiveWeightTotal + weightPercent;

  function openAddModal() {
    setEditingId(null);
    setName(emptyName);
    setWeightPercent(defaultWeightPercent);
    setCriteriaRows([]);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditingActive(category.isActive);
    setName(category.name);
    setWeightPercent(category.weightPercent);
    setCriteriaRows(
      category.criteria.map((c) => ({ key: c.id, id: c.id, name: c.name, maxScore: c.maxScore, isActive: c.isActive })),
    );
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setName(emptyName);
    setWeightPercent(defaultWeightPercent);
    setCriteriaRows([]);
    setFieldErrors({});
  }

  function addCriterionRow() {
    setCriteriaRows((prev) => [...prev, newRow()]);
  }

  function updateCriterionRow(key: string, patch: Partial<CriterionRow>) {
    setCriteriaRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeCriterionRow(key: string) {
    setCriteriaRows((prev) => prev.filter((row) => row.key !== key));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const criteria: CriterionInput[] = criteriaRows
        .map(({ key: _key, ...rest }) => rest)
        .filter((c) => c.name.trim().length > 0);
      const payload = { name, weightPercent, criteria };
      if (editingId) {
        const updated = await updateCategory(editingId, { ...payload, isActive: editingActive });
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success(`"${updated.name}" was updated.`);
      } else {
        const created = await createCategory(payload);
        setCategories((prev) => [...prev, created]);
        toast.success(`"${created.name}" was added to the interview rubric.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setName(emptyName);
      setWeightPercent(defaultWeightPercent);
      setCriteriaRows([]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save category");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteCategory(pendingDelete.id);
      setCategories((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      toast.success(`"${pendingDelete.name}" was deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete category");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Categories</h1>
        <div className="data-table-actions">
          <button type="button" className="secondary" onClick={() => setShowApplicantScores(true)}>
            Applicant Scores
          </button>
          <button type="button" onClick={openAddModal}>
            Add Category
          </button>
        </div>
      </div>
      <p>
        The interview rubric panel members score applicants against, grouped into categories, each worth a fixed
        percent of the overall evaluation (e.g. 25%) regardless of how many criteria/questions it has or what their
        raw points sum to - a panelist&apos;s raw scores within a category are normalized to that percent. Each
        category is made up of individually-scored criteria/questions - a panelist marks every one of those, not the
        category as a whole - and a criterion/question with recorded scores can&apos;t be removed, only deactivated,
        so past scores stay intact.
      </p>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Weight (%)</th>
                <th>Raw max score</th>
                <th>Criteria/Questions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No categories yet.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.weightPercent}%</td>
                  <td>{category.maxScore}</td>
                  <td>{category.criteria.length}</td>
                  <td>
                    <span className={`badge ${category.isActive ? "open" : "closed"}`}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button type="button" className="secondary" onClick={() => setViewingCriteriaFor(category)}>
                        View Criteria
                      </button>
                      <button type="button" className="secondary" onClick={() => startEdit(category)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => setPendingDelete(category)}>
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
        wide
        title={editingId ? "Edit category" : "Add category"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="category-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update category" : "Add category"}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.name ? "field has-error" : "field"}>
            <label htmlFor="name" className="required">
              Name
            </label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            <FieldError message={fieldErrors.name} />
          </div>
          <div className={fieldErrors.weightPercent ? "field has-error" : "field"}>
            <label htmlFor="weightPercent" className="required">
              Weight (% of overall evaluation)
            </label>
            <input
              id="weightPercent"
              type="number"
              min={1}
              max={100}
              required
              value={weightPercent}
              onChange={(e) => setWeightPercent(Number(e.target.value))}
              style={{ maxWidth: "8rem" }}
            />
            <p className="field-hint">
              This category is worth exactly this percent of the overall evaluation, no matter how many
              criteria/questions it has or what their raw points sum to below - a panelist&apos;s raw scores in this
              category are normalized to this percent.
            </p>
            {projectedWeightTotal !== 100 && (
              <p className="field-hint">
                Active categories would total {projectedWeightTotal}% with this value — usually expected to add up to
                100%.
              </p>
            )}
            <FieldError message={fieldErrors.weightPercent} />
          </div>
          <div className={fieldErrors.criteria ? "field has-error" : "field"}>
            <label>Criteria / Questions</label>
            <p className="field-hint">
              Each one is scored individually by a panelist (0 up to its own max score) - this is just the raw
              grading scale, not the category&apos;s real weight above. Example: whether split into 2 criteria/questions
              or 10, a category worth 25% still only ever contributes 25% to the overall evaluation.
            </p>
            {criteriaRows.map((row) => (
              <div key={row.key} className="data-table-actions" style={{ marginBottom: "0.5rem", alignItems: "flex-start" }}>
                <input
                  aria-label="Criterion/question name"
                  placeholder="e.g. Clarity of response"
                  value={row.name}
                  onChange={(e) => updateCriterionRow(row.key, { name: e.target.value })}
                  style={{ flex: 2 }}
                />
                <input
                  aria-label="Max score"
                  type="number"
                  min={1}
                  value={row.maxScore}
                  onChange={(e) => updateCriterionRow(row.key, { maxScore: Number(e.target.value) })}
                  style={{ width: "6rem" }}
                />
                {row.id && (
                  <label className="data-table-actions" style={{ alignItems: "center", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={row.isActive ?? true}
                      onChange={(e) => updateCriterionRow(row.key, { isActive: e.target.checked })}
                    />
                    Active
                  </label>
                )}
                <button type="button" className="danger" onClick={() => removeCriterionRow(row.key)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addCriterionRow}>
              Add Criterion/Question
            </button>
            <FieldError message={fieldErrors.criteria} />
            <p className="field-hint">
              Raw total: {formTotal} pt(s) (internal grading scale only - actual weight in the overall evaluation is{" "}
              {weightPercent}%, set above)
            </p>
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
        open={viewingCriteriaFor !== null}
        title={`Criteria / Questions — ${viewingCriteriaFor?.name ?? ""}`}
        onClose={() => setViewingCriteriaFor(null)}
        footer={
          <button type="button" className="secondary" onClick={() => setViewingCriteriaFor(null)}>
            Close
          </button>
        }
      >
        {viewingCriteriaFor && viewingCriteriaFor.criteria.length === 0 && (
          <p>No criteria/questions have been added for this category yet.</p>
        )}
        {viewingCriteriaFor && viewingCriteriaFor.criteria.length > 0 && (
          <ol>
            {viewingCriteriaFor.criteria.map((criterion) => (
              <li key={criterion.id} style={{ marginBottom: "0.5rem" }}>
                {criterion.name} (0-{criterion.maxScore}){!criterion.isActive && " — inactive"}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      {showApplicantScores && <ApplicantScoresModal onClose={() => setShowApplicantScores(false)} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete category?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> and all its criteria/questions will be permanently deleted. This
            can&apos;t be undone, and is blocked if any of its criteria/questions already have recorded scores.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
