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
import { useAuth } from "@/shared/auth/AuthContext";
import { AdminShell } from "../components/AdminShell";
import { createUser, deleteUser, listUsers, updateUser } from "../api/adminUsersApi";
import type { AdminUser, CreateUserInput, UserRole } from "../types";

const emptyForm = { email: "", password: "", role: "APPLICANT" as UserRole };

export function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const pagination = usePagination(users, 10);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setFieldErrors({});
    setModalOpen(true);
  }

  function startEdit(target: AdminUser) {
    setEditingId(target.id);
    setForm({ email: target.email, password: "", role: target.role });
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
        const updated = await updateUser(editingId, { email: form.email, role: form.role });
        setUsers((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
        toast.success(`Updated ${updated.email}.`);
      } else {
        const input: CreateUserInput = { email: form.email, password: form.password, role: form.role };
        const created = await createUser(input);
        setUsers((prev) => [created, ...prev]);
        toast.success(`Created ${created.role.toLowerCase()} account for ${created.email}.`);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save user");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteUser(pendingDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== pendingDelete.id));
      toast.success(`Deleted ${pendingDelete.email}.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    }
  }

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Users Management</h1>
        <button type="button" onClick={openAddModal}>
          Add User
        </button>
      </div>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No users yet.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((target) => {
                const isSelf = target.id === currentUser?.id;
                return (
                  <tr key={target.id}>
                    <td>{target.email}</td>
                    <td>{target.role}</td>
                    <td>{new Date(target.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="data-table-actions">
                        <button type="button" className="secondary" onClick={() => startEdit(target)}>
                          Edit
                        </button>
                        {isSelf ? (
                          <span className="user-email">(you)</span>
                        ) : (
                          <button type="button" className="danger" onClick={() => setPendingDelete(target)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        title={editingId ? "Edit user" : "Add user"}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={submitting} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="user-form" disabled={submitting}>
              {submitting && <Spinner size="sm" onDark />}
              {submitting ? "Saving..." : editingId ? "Update user" : "Create user"}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.email ? "field has-error" : "field"}>
            <label htmlFor="email" className="required">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <FieldError message={fieldErrors.email} />
          </div>
          {!editingId && (
            <div className={fieldErrors.password ? "field has-error" : "field"}>
              <label htmlFor="password" className="required">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <FieldError message={fieldErrors.password} />
            </div>
          )}
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              <option value="APPLICANT">Applicant</option>
              <option value="PANEL">Panel</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete user?"
        description={
          <>
            <strong>{pendingDelete?.email}</strong> will be permanently deleted, along with their applicant
            profile and everything under it, if any. This can't be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
