import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { InlineConfirmButton } from "@/shared/components/InlineConfirmButton";
import { useAuth } from "@/shared/auth/AuthContext";
import { AdminShell } from "../components/AdminShell";
import { createUser, deleteUser, listUsers, updateUser } from "../api/adminUsersApi";
import type { AdminUser, CreateUserInput, UserRole } from "../types";

const emptyForm = { email: "", password: "", role: "APPLICANT" as UserRole };

export function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(target: AdminUser) {
    setEditingId(target.id);
    setForm({ email: target.email, password: "", role: target.role });
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
        const updated = await updateUser(editingId, { email: form.email, role: form.role });
        setUsers((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
        setMessage(`Updated ${updated.email}.`);
        cancelEdit();
      } else {
        const input: CreateUserInput = { email: form.email, password: form.password, role: form.role };
        const created = await createUser(input);
        setUsers((prev) => [created, ...prev]);
        setMessage(`Created ${created.role.toLowerCase()} account for ${created.email}.`);
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    }
  }

  return (
    <AdminShell>
      <h1>Users Management</h1>
      <ErrorBanner message={error} />
      {message && <div className="card">{message}</div>}

      <div className="card">
        <h2>{editingId ? "Edit user" : "New user"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {!editingId && (
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="role">Role</label>
              <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                <option value="APPLICANT">Applicant</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="actions-row">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update user" : "Create user"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <h2>All users</h2>
      {loading && <p>Loading...</p>}
      {!loading && users.length === 0 && <p>No users yet.</p>}
      {!loading && users.length > 0 && (
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
            {users.map((target) => {
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
                        <InlineConfirmButton onConfirm={() => handleDelete(target.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
