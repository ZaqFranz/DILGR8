import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { addAward, removeAward } from "../api/applicantsApi";
import { removeDocument, uploadDocument } from "../api/documentsApi";
import type { ApplicantDocument, Award } from "../types";

interface Props {
  items: Award[];
  onChange: (items: Award[]) => void;
  documents: ApplicantDocument[];
  onDocumentsChange: (documents: ApplicantDocument[]) => void;
}

const emptyForm = { title: "", dateAwarded: "", issuingBody: "" };
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export function AwardsSection({ items, onChange, documents, onDocumentsChange }: Props) {
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
    if (!form.dateAwarded) errors.dateAwarded = "Date awarded is required.";
    if (!form.issuingBody.trim()) errors.issuingBody = "Issuing body is required.";
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

  async function handleAttachProof(awardId: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("File is too large — the maximum size is 5MB.");
      return;
    }
    setUploadingForId(awardId);
    try {
      const uploaded = await uploadDocument(file, "AWARD_PROOF", undefined, undefined, awardId);
      onDocumentsChange([uploaded, ...documents]);
      toast.success("Proof uploaded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload proof");
    } finally {
      setUploadingForId(null);
      const input = fileInputRefs.current[awardId];
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
      <h2>Awards / Commendations</h2>
      <p>
        Upload proof of each claim (e.g. certificate or citation) as a PDF, JPEG, or PNG, max 5MB. One file per
        award - remove the current file to upload a different one.
      </p>
      <ErrorBanner message={error} />
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date awarded</th>
                <th>Issuing body</th>
                <th>Proof</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const proofs = documents.filter((doc) => doc.awardId === item.id);
                return (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.dateAwarded.slice(0, 10)}</td>
                    <td>{item.issuingBody}</td>
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
        <div className={fieldErrors.dateAwarded ? "field has-error" : "field"}>
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
          <FieldError message={fieldErrors.dateAwarded} />
        </div>
        <div className={fieldErrors.issuingBody ? "field has-error" : "field"}>
          <label htmlFor="award-body" className="required">
            Issuing body
          </label>
          <input
            id="award-body"
            required
            value={form.issuingBody}
            onChange={(e) => setForm({ ...form, issuingBody: e.target.value })}
          />
          <FieldError message={fieldErrors.issuingBody} />
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
