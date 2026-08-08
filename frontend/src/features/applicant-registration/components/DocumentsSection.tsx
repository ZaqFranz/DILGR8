import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { removeDocument, uploadDocument } from "../api/documentsApi";
import type { ApplicantDocument, DocumentType } from "../types";

interface Props {
  items: ApplicantDocument[];
  onChange: (items: ApplicantDocument[]) => void;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ELIGIBILITY_PROOF: "Eligibility Proof",
  IPCR: "IPCR (promotional)",
  DESIGNATION_ORDER: "Designation to Higher Position (promotional)",
  LD_PROOF: "Learning & Development Proof",
  OTHER: "Other",
};

// LD_PROOF is uploaded per-entry from the Learning & Development section
// (tied to a specific LdIntervention via ldInterventionId), not picked from
// this generic type dropdown - it's still in the label map above so any
// such document still renders correctly if it shows up in this flat list.
const SELECTABLE_DOCUMENT_TYPES = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).filter(
  (type) => type !== "LD_PROOF",
);

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export function DocumentsSection({ items, onChange }: Props) {
  const toast = useToast();
  const [type, setType] = useState<DocumentType>("ELIGIBILITY_PROOF");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFileError(null);
    if (!file) {
      setFileError("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setFileError("File is too large — the maximum size is 5MB.");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadDocument(file, type);
      onChange([uploaded, ...items]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`${DOCUMENT_TYPE_LABELS[type]} uploaded.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!pendingRemoveId) return;
    setError(null);
    try {
      await removeDocument(pendingRemoveId);
      onChange(items.filter((item) => item.id !== pendingRemoveId));
      toast.success("Document removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove document");
    } finally {
      setPendingRemoveId(null);
    }
  }

  return (
    <div className="card">
      <h2>Documents</h2>
      <p>
        Upload proof of eligibility here if you indicated one on your profile. Promotional applications also
        require an uploaded IPCR and Designation to a Higher Position document.
      </p>
      <ErrorBanner message={error} />
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{DOCUMENT_TYPE_LABELS[item.type]}</td>
                  <td>{item.fileName}</td>
                  <td>{new Date(item.uploadedAt).toLocaleDateString()}</td>
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

      <form onSubmit={handleUpload} className="field-grid" style={{ marginTop: "1rem" }} noValidate>
        <div className="field">
          <label htmlFor="doc-type" className="required">
            Document type
          </label>
          <select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {SELECTABLE_DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={fileError ? "field has-error" : "field"}>
          <label htmlFor="doc-file" className="required">
            File (PDF, JPEG, or PNG, max 5MB)
          </label>
          <input
            id="doc-file"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFileError(null);
            }}
          />
          <FieldError message={fileError} />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner size="sm" onDark />}
            {submitting ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingRemoveId !== null}
        title="Remove this document?"
        description="This file will be permanently deleted."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
