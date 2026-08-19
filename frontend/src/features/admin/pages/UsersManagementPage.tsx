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
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_HINT } from "@/shared/utils/passwordPolicy";
import { usePagination } from "@/shared/utils/usePagination";
import { useAuth } from "@/shared/auth/AuthContext";
import { AdminShell } from "../components/AdminShell";
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser } from "../api/adminUsersApi";
import type { AdminUser, CreateUserInput, UserRole } from "../types";

// Applicants self-register via /register - this page only ever creates
// ADMIN/PANEL accounts, so PANEL (not APPLICANT) is the sensible default.
const emptyForm = { email: "", password: "", role: "PANEL" as UserRole, name: "" };

// User.name is only ever set for ADMIN/PANEL accounts (via this page's own
// form) - APPLICANT accounts' real name lives on their Applicant profile
// from registration instead, so it's the fallback here rather than email.
function getDisplayName(user: AdminUser): string {
  if (user.name) return user.name;
  if (user.applicant) return `${user.applicant.firstName} ${user.applicant.lastName}`;
  return user.email;
}

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
  const [pendingReset, setPendingReset] = useState<AdminUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  const filteredUsers = users.filter((target) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" || getDisplayName(target).toLowerCase().includes(term) || target.email.toLowerCase().includes(term);
    return (roleFilter === "" || target.role === roleFilter) && matchesSearch;
  });
  const pagination = usePagination(filteredUsers, 10);

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
    setForm({ email: target.email, password: "", role: target.role, name: target.name ?? "" });
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
        const name = form.name.trim() ? form.name.trim() : undefined;
        const updated = await updateUser(editingId, { email: form.email, role: form.role, name });
        setUsers((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
        toast.success(`Updated ${getDisplayName(updated)}.`);
      } else {
        const input: CreateUserInput = {
          email: form.email,
          password: form.password,
          role: form.role,
          name: form.name.trim(),
        };
        const created = await createUser(input);
        setUsers((prev) => [created, ...prev]);
        toast.success(`Created ${created.role.toLowerCase()} account for ${getDisplayName(created)}.`);
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
      toast.success(`Deleted ${getDisplayName(pendingDelete)}.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    }
  }

  async function handleResetPassword() {
    if (!pendingReset) return;
    setError(null);
    try {
      await resetUserPassword(pendingReset.id);
      toast.success(`Temporary password emailed to ${pendingReset.email}.`);
      setPendingReset(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
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

      {!loading && users.length > 0 && (
        <div className="filters-row">
          <div className="field">
            <label htmlFor="user-search">Search</label>
            <input
              id="user-search"
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="role-filter">Role</label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as UserRole | "");
                pagination.setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="PANEL">Panel</option>
              <option value="APPLICANT">Applicant</option>
            </select>
          </div>
        </div>
      )}

      {loading && <LoadingBlock />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
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
              {users.length > 0 && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No users match your search/filter.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((target) => {
                const isSelf = target.id === currentUser?.id;
                return (
                  <tr key={target.id}>
                    <td>{getDisplayName(target)}</td>
                    <td>{target.role}</td>
                    <td>{new Date(target.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="data-table-actions">
                        <button type="button" className="secondary" onClick={() => startEdit(target)}>
                          Edit
                        </button>
                        <button type="button" className="secondary" onClick={() => setPendingReset(target)}>
                          Reset Password
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
          <div className={fieldErrors.name ? "field has-error" : "field"}>
            <label htmlFor="name" className={editingId ? undefined : "required"}>
              Full name{editingId ? " (optional)" : ""}
            </label>
            <input
              id="name"
              required={!editingId}
              placeholder="e.g. Juan Dela Cruz"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FieldError message={fieldErrors.name} />
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
                minLength={PASSWORD_MIN_LENGTH}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <FieldError message={fieldErrors.password} />
              {!fieldErrors.password && <p className="field-hint">{PASSWORD_REQUIREMENTS_HINT}</p>}
            </div>
          )}
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {/* Applicants self-register via /register - Admin/Panel accounts are the
                  only ones created here. Editing an existing Applicant account is still
                  possible (email/name), so its current role stays selectable in that case
                  rather than forcing a role change just to save unrelated edits. */}
              {editingId && form.role === "APPLICANT" && <option value="APPLICANT">Applicant</option>}
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
            <strong>{pendingDelete ? getDisplayName(pendingDelete) : ""}</strong> will be permanently deleted, along
            with their applicant profile and everything under it, if any. This can't be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingReset !== null}
        title="Reset password?"
        description={
          <>
            A temporary password will be emailed to <strong>{pendingReset?.email}</strong>, replacing their
            current password immediately. They'll be required to set a new password the next time they log in.
          </>
        }
        confirmLabel="Reset Password"
        danger={false}
        onConfirm={handleResetPassword}
        onCancel={() => setPendingReset(null)}
      />
    </AdminShell>
  );
}
