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
  createComplianceRequirement,
  deleteComplianceRequirement,
  listComplianceRequirements,
  updateComplianceRequirement,
} from "../api/complianceRequirementsApi";
import type { ComplianceRequirement, CreateComplianceRequirementInput } from "../types";

const emptyForm: CreateComplianceRequirementInput = { name: "", description: "" };

export function ComplianceRequirementsPage() {
  const toast = useToast();
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateComplianceRequirementInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ComplianceRequirement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const pagination = usePagination(requirements, 10);

  useEffect(() => {
    listComplianceRequirements()
      .then(setRequirements)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load compliance requirements"))
      .finally(() => setLoading(false));
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(requirement: ComplianceRequirement) {
    setEditingId(requirement.id);
    setEditingActive(requirement.isActive);
    setForm({
      name: requirement.name,
      description: requirement.description ?? "",
      sortOrder: requirement.sortOrder,
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
        const updated = await updateComplianceRequirement(editingId, { ...form, isActive: editingActive });
        setRequirements((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        toast.success(`"${updated.name}" was updated.`);
      } else {
        const created = await createComplianceRequirement(form);
        setRequirements((prev) => [...prev, created]);
        toast.success(`"${created.name}" was added to the compliance checklist.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save compliance requirement");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteComplianceRequirement(pendingDelete.id);
      setRequirements((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      toast.success(`"${pendingDelete.name}" was deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete compliance requirement");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Compliance Requirements</h1>
        <button type="button" onClick={openAddModal}>
          Add Requirement
        </button>
      </div>
      <p>
        The CSC-mandated documentary checklist an applicant must submit and have verified before moving to
        oath-taking. A requirement with applicant submissions can&apos;t be deleted - deactivate it instead so past
        submissions stay intact.
      </p>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requirements.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No compliance requirements yet.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((requirement) => (
                <tr key={requirement.id}>
                  <td>{requirement.name}</td>
                  <td>{requirement.description ?? "-"}</td>
                  <td>
                    <span className={`badge ${requirement.isActive ? "open" : "closed"}`}>
                      {requirement.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button type="button" className="secondary" onClick={() => startEdit(requirement)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => setPendingDelete(requirement)}>
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
        title={editingId ? "Edit requirement" : "Add requirement"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="requirement-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update requirement" : "Add requirement"}
            </button>
          </>
        }
      >
        <form id="requirement-form" onSubmit={handleSubmit} noValidate>
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
          <div className={fieldErrors.description ? "field has-error" : "field"}>
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <FieldError message={fieldErrors.description} />
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete requirement?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be permanently deleted. This can&apos;t be undone, and is
            blocked if any applicant already has a submission against it.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
