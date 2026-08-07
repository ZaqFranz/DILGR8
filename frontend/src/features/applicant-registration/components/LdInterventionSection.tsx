import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { addLdIntervention, removeLdIntervention } from "../api/applicantsApi";
import type { LdIntervention } from "../types";

interface Props {
  items: LdIntervention[];
  onChange: (items: LdIntervention[]) => void;
}

const emptyForm = { title: "", dateAttended: "", numberOfHours: "", sponsoringAgency: "" };

export function LdInterventionSection({ items, onChange }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await addLdIntervention({
        title: form.title,
        dateAttended: form.dateAttended,
        numberOfHours: Number(form.numberOfHours),
        sponsoringAgency: form.sponsoringAgency,
      });
      onChange([...items, created]);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add L&D intervention");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeLdIntervention(id);
      onChange(items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove L&D intervention");
    }
  }

  return (
    <div className="card">
      <h2>Learning &amp; Development Interventions Attended</h2>
      <ErrorBanner message={error} />
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
          <label htmlFor="ld-title">Title</label>
          <input id="ld-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ld-date">Date attended</label>
          <input
            id="ld-date"
            type="date"
            required
            value={form.dateAttended}
            onChange={(e) => setForm({ ...form, dateAttended: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="ld-hours">Number of hours</label>
          <input
            id="ld-hours"
            type="number"
            min={1}
            required
            value={form.numberOfHours}
            onChange={(e) => setForm({ ...form, numberOfHours: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="ld-agency">Sponsoring agency</label>
          <input
            id="ld-agency"
            required
            value={form.sponsoringAgency}
            onChange={(e) => setForm({ ...form, sponsoringAgency: e.target.value })}
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
