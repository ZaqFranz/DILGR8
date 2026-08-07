import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
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
  OTHER: "Other",
};

export function DocumentsSection({ items, onChange }: Props) {
  const [type, setType] = useState<DocumentType>("ELIGIBILITY_PROOF");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadDocument(file, type);
      onChange([uploaded, ...items]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeDocument(id);
      onChange(items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove document");
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
                <button type="button" className="danger" onClick={() => handleRemove(item.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleUpload} className="field-grid" style={{ marginTop: "1rem" }}>
        <div className="field">
          <label htmlFor="doc-type">Document type</label>
          <select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-file">File (PDF, JPEG, or PNG, max 5MB)</label>
          <input
            id="doc-file"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
