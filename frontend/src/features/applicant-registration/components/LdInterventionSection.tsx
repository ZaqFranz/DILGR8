import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { addLdIntervention, removeLdIntervention } from "../api/applicantsApi";
import { removeDocument, uploadDocument } from "../api/documentsApi";
import type { ApplicantDocument, LdIntervention } from "../types";

interface Props {
  items: LdIntervention[];
  onChange: (items: LdIntervention[]) => void;
  documents: ApplicantDocument[];
  onDocumentsChange: (documents: ApplicantDocument[]) => void;
}

const emptyForm = { title: "", dateAttended: "", numberOfHours: "", sponsoringAgency: "" };
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export function LdInterventionSection({ items, onChange, documents, onDocumentsChange }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingRemoveProofId, setPendingRemoveProofId] = useState<string | null>(null);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required.";
    if (!form.dateAttended) errors.dateAttended = "Date attended is required.";
    const numberOfHours = Number(form.numberOfHours);
    if (!form.numberOfHours || !Number.isInteger(numberOfHours) || numberOfHours <= 0) {
      errors.numberOfHours = "Enter a whole number of hours greater than 0.";
    }
    if (!form.sponsoringAgency.trim()) errors.sponsoringAgency = "Sponsoring agency is required.";
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

    const numberOfHours = Number(form.numberOfHours);
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

  async function handleAttachProof(interventionId: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("File is too large — the maximum size is 5MB.");
      return;
    }
    setUploadingForId(interventionId);
    try {
      const uploaded = await uploadDocument(file, "LD_PROOF", undefined, interventionId);
      onDocumentsChange([uploaded, ...documents]);
      toast.success("Proof uploaded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload proof");
    } finally {
      setUploadingForId(null);
      const input = fileInputRefs.current[interventionId];
      if (input) input.value = "";
    }
  }

  async function handleRemoveProof() {
    if (!pendingRemoveProofId) return;
    setError(null);
    try {
      await removeDocument(pendingRemoveProofId);
      onDocumentsChange(documents.filter((doc) => doc.id !== pendingRemoveProofId));
      toast.success("Proof removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove proof");
    } finally {
      setPendingRemoveProofId(null);
    }
  }

  return (
    <div className="card">
      <h2>Learning &amp; Development Interventions Attended</h2>
      <p>
        Upload proof of each claim (e.g. certificate of attendance) as a PDF, JPEG, or PNG, max 5MB. One file per
        entry - remove the current file to upload a different one.
      </p>
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
                <th>Proof</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const proofs = documents.filter((doc) => doc.ldInterventionId === item.id);
                return (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.dateAttended.slice(0, 10)}</td>
                    <td>{item.numberOfHours}</td>
                    <td>{item.sponsoringAgency}</td>
                    <td>
                      {proofs.map((doc) => (
                        <div key={doc.id} className="proof-item">
                          <span>{doc.fileName}</span>
                          <button type="button" className="danger" onClick={() => setPendingRemoveProofId(doc.id)}>
                            Remove
                          </button>
                        </div>
                      ))}
                      {proofs.length === 0 && (
                        <input
                          ref={(el) => {
                            fileInputRefs.current[item.id] = el;
                          }}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          disabled={uploadingForId === item.id}
                          onChange={(e) => handleAttachProof(item.id, e.target.files?.[0])}
                        />
                      )}
                      {uploadingForId === item.id && <Spinner size="sm" />}
                    </td>
                    <td>
                      <button type="button" className="danger" onClick={() => setPendingRemoveId(item.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} className="field-grid" style={{ marginTop: "1rem" }} noValidate>
        <div className={fieldErrors.title ? "field has-error" : "field"}>
          <label htmlFor="ld-title" className="required">
            Title
          </label>
          <input id="ld-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <FieldError message={fieldErrors.title} />
        </div>
        <div className={fieldErrors.dateAttended ? "field has-error" : "field"}>
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
          <FieldError message={fieldErrors.dateAttended} />
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
        <div className={fieldErrors.sponsoringAgency ? "field has-error" : "field"}>
          <label htmlFor="ld-agency" className="required">
            Sponsoring agency
          </label>
          <input
            id="ld-agency"
            required
            value={form.sponsoringAgency}
            onChange={(e) => setForm({ ...form, sponsoringAgency: e.target.value })}
          />
          <FieldError message={fieldErrors.sponsoringAgency} />
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

      <ConfirmDialog
        open={pendingRemoveProofId !== null}
        title="Remove this proof file?"
        description="This file will be permanently deleted."
        confirmLabel="Remove"
        onConfirm={handleRemoveProof}
        onCancel={() => setPendingRemoveProofId(null)}
      />
    </div>
  );
}
