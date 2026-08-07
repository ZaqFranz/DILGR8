import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { addWorkExperience, removeWorkExperience } from "../api/applicantsApi";
import type { WorkExperience } from "../types";

interface Props {
  items: WorkExperience[];
  onChange: (items: WorkExperience[]) => void;
}

const emptyForm = { inclusiveFrom: "", inclusiveTo: "", positionDesignation: "", agency: "" };

export function WorkExperienceSection({ items, onChange }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add work experience");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeWorkExperience(id);
      onChange(items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove work experience");
    }
  }

  return (
    <div className="card">
      <h2>Work Experience</h2>
      <ErrorBanner message={error} />
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
                <button type="button" className="danger" onClick={() => handleRemove(item.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleAdd} className="field-grid" style={{ marginTop: "1rem" }}>
        <div className="field">
          <label htmlFor="we-from">Inclusive from</label>
          <input
            id="we-from"
            type="date"
            required
            value={form.inclusiveFrom}
            onChange={(e) => setForm({ ...form, inclusiveFrom: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="we-to">Inclusive to (blank if present)</label>
          <input
            id="we-to"
            type="date"
            value={form.inclusiveTo}
            onChange={(e) => setForm({ ...form, inclusiveTo: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="we-position">Position / Designation</label>
          <input
            id="we-position"
            required
            value={form.positionDesignation}
            onChange={(e) => setForm({ ...form, positionDesignation: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="we-agency">Agency</label>
          <input
            id="we-agency"
            required
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value })}
          />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
