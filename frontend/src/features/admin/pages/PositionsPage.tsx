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
import { formatUserDisplayName } from "@/shared/utils/formatUserDisplayName";
import { AdminShell } from "../components/AdminShell";
import { listUsers } from "../api/adminUsersApi";
import { createPosition, deletePosition, listPositions, updatePosition } from "../api/positionsApi";
import type { AdminUser, CreatePositionInput, Position } from "../types";

const emptyForm: CreatePositionInput = { title: "" };

export function PositionsPage() {
  const toast = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [panelUsers, setPanelUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreatePositionInput>(emptyForm);
  const [selectedPanelUserIds, setSelectedPanelUserIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Position | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const pagination = usePagination(positions, 10);

  useEffect(() => {
    Promise.all([listPositions(), listUsers({ role: "PANEL" })])
      .then(([loadedPositions, loadedPanelUsers]) => {
        setPositions(loadedPositions);
        setPanelUsers(loadedPanelUsers);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load positions"))
      .finally(() => setLoading(false));
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedPanelUserIds([]);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(position: Position) {
    setEditingId(position.id);
    setForm({ title: position.title });
    setSelectedPanelUserIds(position.panelMembers.map((member) => member.panelUserId));
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSelectedPanelUserIds([]);
    setFieldErrors({});
  }

  function togglePanelUser(panelUserId: string, checked: boolean) {
    setSelectedPanelUserIds((prev) =>
      checked ? [...prev, panelUserId] : prev.filter((id) => id !== panelUserId),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = { ...form, panelUserIds: selectedPanelUserIds };
      if (editingId) {
        const updated = await updatePosition(editingId, payload);
        setPositions((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success(`"${updated.title}" was updated.`);
      } else {
        const created = await createPosition(payload);
        setPositions((prev) => [...prev, created]);
        toast.success(`"${created.title}" was added.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setSelectedPanelUserIds([]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save position");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deletePosition(pendingDelete.id);
      setPositions((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      toast.success(`"${pendingDelete.title}" was deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete position");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Positions</h1>
        <button type="button" onClick={openAddModal}>
          Add Position
        </button>
      </div>
      <p>
        Reusable positions selected from a dropdown when posting a job, instead of typing a title by hand. Each
        position can carry a pre-made group of Panel members, who are automatically assigned to a posting's
        interview board the moment it's created from that position.
      </p>
      <ErrorBanner message={error} />

      {panelUsers.length === 0 && !loading && (
        <p className="field-hint">
          No Panel accounts exist yet - you can still add positions, but there won&apos;t be any panel members to
          pre-select until one is created in Users Management.
        </p>
      )}

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Default panel members</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={3} className="table-empty">
                    No positions yet.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((position) => (
                <tr key={position.id}>
                  <td>{position.title}</td>
                  <td>
                    {position.panelMembers.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      position.panelMembers.map((member) => formatUserDisplayName(member.panelUser)).join(", ")
                    )}
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button type="button" className="secondary" onClick={() => startEdit(position)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => setPendingDelete(position)}>
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
        title={editingId ? "Edit position" : "Add position"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="position-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update position" : "Add position"}
            </button>
          </>
        }
      >
        <form id="position-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.title ? "field has-error" : "field"}>
            <label htmlFor="title" className="required">
              Title
            </label>
            <input
              id="title"
              required
              placeholder="e.g. Administrative Officer II"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <FieldError message={fieldErrors.title} />
          </div>
          <div className={fieldErrors.panelUserIds ? "field has-error" : "field"}>
            <label>Default panel members (optional)</label>
            {panelUsers.length === 0 ? (
              <p className="field-hint">No Panel accounts exist yet.</p>
            ) : (
              <div className="checkbox-group">
                {panelUsers.map((panelUser) => (
                  <label key={panelUser.id} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={selectedPanelUserIds.includes(panelUser.id)}
                      onChange={(e) => togglePanelUser(panelUser.id, e.target.checked)}
                    />
                    {formatUserDisplayName(panelUser)}
                  </label>
                ))}
              </div>
            )}
            <p className="field-hint">
              Automatically assigned to a posting's interview board when it's created from this position.
            </p>
            <FieldError message={fieldErrors.panelUserIds} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete position?"
        description={
          <>
            <strong>{pendingDelete?.title}</strong> will be permanently deleted. This can&apos;t be undone. Job
            postings already created from it keep their title and panel assignments - only the reusable position
            entry itself is removed.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
