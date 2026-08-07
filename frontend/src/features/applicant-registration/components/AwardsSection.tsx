import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { addAward, removeAward } from "../api/applicantsApi";
import type { Award } from "../types";

interface Props {
  items: Award[];
  onChange: (items: Award[]) => void;
}

const emptyForm = { title: "", dateAwarded: "", issuingBody: "" };

export function AwardsSection({ items, onChange }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await addAward(form);
      onChange([...items, created]);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add award");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeAward(id);
      onChange(items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove award");
    }
  }

  return (
    <div className="card">
      <h2>Awards / Commendations</h2>
      <ErrorBanner message={error} />
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
          <label htmlFor="award-title">Title</label>
          <input
            id="award-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="award-date">Date awarded</label>
          <input
            id="award-date"
            type="date"
            required
            value={form.dateAwarded}
            onChange={(e) => setForm({ ...form, dateAwarded: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="award-body">Issuing body</label>
          <input
            id="award-body"
            required
            value={form.issuingBody}
            onChange={(e) => setForm({ ...form, issuingBody: e.target.value })}
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
