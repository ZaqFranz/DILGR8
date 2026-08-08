import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { addLdIntervention, removeLdIntervention } from "../api/applicantsApi";
import type { LdIntervention } from "../types";

interface Props {
  items: LdIntervention[];
  onChange: (items: LdIntervention[]) => void;
}

const emptyForm = { title: "", dateAttended: "", numberOfHours: "", sponsoringAgency: "" };

export function LdInterventionSection({ items, onChange }: Props) {
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

    const numberOfHours = Number(form.numberOfHours);
    if (!Number.isInteger(numberOfHours) || numberOfHours <= 0) {
      setFieldErrors({ numberOfHours: "Enter a whole number of hours greater than 0." });
      setError("Please fix the highlighted field before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await addLdIntervention({
        title: form.title,
        dateAttended: form.dateAttended,
        numberOfHours,
        sponsoringAgency: form.sponsoringAgency,
      });
      onChange([...items, created]);
      setForm(emptyForm);
      toast.success("Learning & Development intervention added.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to add L&D intervention");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!pendingRemoveId) return;
    setError(null);
    try {
      await removeLdIntervention(pendingRemoveId);
      onChange(items.filter((item) => item.id !== pendingRemoveId));
      toast.success("Intervention removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove L&D intervention");
    } finally {
      setPendingRemoveId(null);
    }
  }

  return (
    <div className="card">
      <h2>Learning &amp; Development Interventions Attended</h2>
      <ErrorBanner message={error} />
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date attended</th>
                <th>Hours</th>
                <th>Sponsoring agency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.dateAttended.slice(0, 10)}</td>
                  <td>{item.numberOfHours}</td>
                  <td>{item.sponsoringAgency}</td>
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
        <div className="field">
          <label htmlFor="ld-title" className="required">
            Title
          </label>
          <input id="ld-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ld-date" className="required">
            Date attended
          </label>
          <input
            id="ld-date"
            type="date"
            required
            value={form.dateAttended}
            onChange={(e) => setForm({ ...form, dateAttended: e.target.value })}
          />
        </div>
        <div className={fieldErrors.numberOfHours ? "field has-error" : "field"}>
          <label htmlFor="ld-hours" className="required">
            Number of hours
          </label>
          <input
            id="ld-hours"
            type="number"
            min={1}
            required
            value={form.numberOfHours}
            onChange={(e) => setForm({ ...form, numberOfHours: e.target.value })}
          />
          <FieldError message={fieldErrors.numberOfHours} />
        </div>
        <div className="field">
          <label htmlFor="ld-agency" className="required">
            Sponsoring agency
          </label>
          <input
            id="ld-agency"
            required
            value={form.sponsoringAgency}
            onChange={(e) => setForm({ ...form, sponsoringAgency: e.target.value })}
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
        title="Remove this intervention?"
        description="This L&D entry will be permanently removed from your profile."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
