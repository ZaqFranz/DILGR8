import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { addAward, removeAward } from "../api/applicantsApi";
import type { Award } from "../types";

interface Props {
  items: Award[];
  onChange: (items: Award[]) => void;
}

const emptyForm = { title: "", dateAwarded: "", issuingBody: "" };

export function AwardsSection({ items, onChange }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await addAward(form);
      onChange([...items, created]);
      setForm(emptyForm);
      toast.success("Award added.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to add award");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!pendingRemoveId) return;
    setError(null);
    try {
      await removeAward(pendingRemoveId);
      onChange(items.filter((item) => item.id !== pendingRemoveId));
      toast.success("Award removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove award");
    } finally {
      setPendingRemoveId(null);
    }
  }

  return (
    <div className="card">
      <h2>Awards / Commendations</h2>
      <ErrorBanner message={error} />
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date awarded</th>
                <th>Issuing body</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.dateAwarded.slice(0, 10)}</td>
                  <td>{item.issuingBody}</td>
                  <td>
                    <button type="button" className="danger" onClick={() => setPendingRemoveId(item.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} className="field-grid" style={{ marginTop: "1rem" }} noValidate>
        <div className={fieldErrors.title ? "field has-error" : "field"}>
          <label htmlFor="award-title" className="required">
            Title
          </label>
          <input
            id="award-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <FieldError message={fieldErrors.title} />
        </div>
        <div className="field">
          <label htmlFor="award-date" className="required">
            Date awarded
          </label>
          <input
            id="award-date"
            type="date"
            required
            value={form.dateAwarded}
            onChange={(e) => setForm({ ...form, dateAwarded: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="award-body" className="required">
            Issuing body
          </label>
          <input
            id="award-body"
            required
            value={form.issuingBody}
            onChange={(e) => setForm({ ...form, issuingBody: e.target.value })}
          />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner size="sm" onDark />}
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingRemoveId !== null}
        title="Remove this award?"
        description="This award will be permanently removed from your profile."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
