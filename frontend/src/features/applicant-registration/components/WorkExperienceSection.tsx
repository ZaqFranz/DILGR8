import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { addWorkExperience, removeWorkExperience } from "../api/applicantsApi";
import type { WorkExperience } from "../types";

interface Props {
  items: WorkExperience[];
  onChange: (items: WorkExperience[]) => void;
}

const emptyForm = { inclusiveFrom: "", inclusiveTo: "", positionDesignation: "", agency: "" };

export function WorkExperienceSection({ items, onChange }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.inclusiveFrom) errors.inclusiveFrom = "Inclusive from date is required.";
    if (!form.positionDesignation.trim()) errors.positionDesignation = "Position/Designation is required.";
    if (!form.agency.trim()) errors.agency = "Agency is required.";
    if (form.inclusiveTo && form.inclusiveFrom && form.inclusiveTo < form.inclusiveFrom) {
      errors.inclusiveTo = "End date can't be earlier than the start date.";
    }
    return errors;
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fill in the highlighted field(s) before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await addWorkExperience({
        inclusiveFrom: form.inclusiveFrom,
        positionDesignation: form.positionDesignation,
        agency: form.agency,
        ...(form.inclusiveTo ? { inclusiveTo: form.inclusiveTo } : {}),
      });
      onChange([...items, created]);
      setForm(emptyForm);
      toast.success("Work experience added.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to add work experience");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!pendingRemoveId) return;
    setError(null);
    try {
      await removeWorkExperience(pendingRemoveId);
      onChange(items.filter((item) => item.id !== pendingRemoveId));
      toast.success("Work experience removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove work experience");
    } finally {
      setPendingRemoveId(null);
    }
  }

  return (
    <div className="card">
      <h2>Work Experience</h2>
      <ErrorBanner message={error} />
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Position/Designation</th>
                <th>Agency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.inclusiveFrom.slice(0, 10)}</td>
                  <td>{item.inclusiveTo ? item.inclusiveTo.slice(0, 10) : "Present"}</td>
                  <td>{item.positionDesignation}</td>
                  <td>{item.agency}</td>
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
        <div className={fieldErrors.inclusiveFrom ? "field has-error" : "field"}>
          <label htmlFor="we-from" className="required">
            Inclusive from
          </label>
          <input
            id="we-from"
            type="date"
            required
            value={form.inclusiveFrom}
            onChange={(e) => setForm({ ...form, inclusiveFrom: e.target.value })}
          />
          <FieldError message={fieldErrors.inclusiveFrom} />
        </div>
        <div className={fieldErrors.inclusiveTo ? "field has-error" : "field"}>
          <label htmlFor="we-to">Inclusive to (optional — blank if present)</label>
          <input
            id="we-to"
            type="date"
            value={form.inclusiveTo}
            onChange={(e) => setForm({ ...form, inclusiveTo: e.target.value })}
          />
          <FieldError message={fieldErrors.inclusiveTo} />
        </div>
        <div className={fieldErrors.positionDesignation ? "field has-error" : "field"}>
          <label htmlFor="we-position" className="required">
            Position / Designation
          </label>
          <input
            id="we-position"
            required
            value={form.positionDesignation}
            onChange={(e) => setForm({ ...form, positionDesignation: e.target.value })}
          />
          <FieldError message={fieldErrors.positionDesignation} />
        </div>
        <div className={fieldErrors.agency ? "field has-error" : "field"}>
          <label htmlFor="we-agency" className="required">
            Agency
          </label>
          <input
            id="we-agency"
            required
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value })}
          />
          <FieldError message={fieldErrors.agency} />
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
        title="Remove work experience?"
        description="This entry will be permanently removed from your profile."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
