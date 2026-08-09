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

// Mirrors the backend's SINGLE_INSTANCE_TYPES (documents.service.ts) -
// re-uploading one of these replaces the existing file rather than adding a
// duplicate, so the frontend needs to know which types that applies to in
// order to drop the stale local entry and show "replaced" instead of
// "uploaded". Necessarily duplicated (no shared package between workspaces),
// same as ELIGIBILITY_LABELS elsewhere in this app.
const SINGLE_INSTANCE_TYPES = new Set<DocumentType>([
  "APPLICATION_LETTER",
  "PDS",
  "IPCR",
  "ELIGIBILITY_PROOF",
  "TRANSCRIPT_OF_RECORDS",
  "DIPLOMA",
  "PQE_NOTICE",
  "DESIGNATION_ORDER",
]);

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  APPLICATION_LETTER: "Application Letter",
  PDS: "Personal Data Sheet (PDS)",
  IPCR: "Performance Rating (Last Rating Period)",
  ELIGIBILITY_PROOF: "Certificate of Eligibility / Rating / License",
  LD_PROOF: "Learning & Development Proof",
  TRANSCRIPT_OF_RECORDS: "Transcript of Records",
  DIPLOMA: "Diploma",
  PQE_NOTICE: "Notice of Passing PQE Result",
  DESIGNATION_ORDER: "Proof of Designation",
  AWARD_PROOF: "Proof of Award(s)",
  OTHER: "Other",
};

// The full application-documents checklist, shown to the applicant so they
// know everything they may need to upload before submitting an application.
// "required" only marks documents this app itself blocks on (Application
// Letter and PDS at registration; Eligibility Proof only if hasEligibility
// is declared; L&D/Award proof only for entries actually added - same rule
// as eligibility, claiming something means proof of that claim is required)
// - every other item is genuinely optional/conditional per the official
// checklist ("if applicable"/"if any"), including Designation proof, which
// is never required to apply even for promotional postings.
const DOCUMENT_CHECKLIST: { type: DocumentType; required: boolean; note?: string }[] = [
  { type: "APPLICATION_LETTER", required: true },
  { type: "PDS", required: true },
  { type: "IPCR", required: false, note: "if applicable" },
  { type: "ELIGIBILITY_PROOF", required: false, note: "required only if you indicated a civil service eligibility above" },
  { type: "LD_PROOF", required: false, note: "required for any entry you add - uploaded per entry in Learning & Development" },
  { type: "TRANSCRIPT_OF_RECORDS", required: false, note: "if applicable, including post-graduate studies" },
  { type: "DIPLOMA", required: false, note: "if applicable, including post-graduate studies" },
  { type: "PQE_NOTICE", required: false, note: "if any" },
  { type: "DESIGNATION_ORDER", required: false, note: "if applicable - optional even when applying to a higher (promotional) position" },
  { type: "AWARD_PROOF", required: false, note: "required for any award you add - uploaded per entry in Awards" },
];

// LD_PROOF and AWARD_PROOF are uploaded per-entry from the Learning &
// Development / Awards sections (tied to a specific LdIntervention/Award via
// ldInterventionId/awardId), not picked from this generic type dropdown -
// they're still in the label map above so such documents still render
// correctly if they show up in this flat list.
const SELECTABLE_DOCUMENT_TYPES = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).filter(
  (type) => type !== "LD_PROOF" && type !== "AWARD_PROOF",
);

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

// Once a single-instance type already has a document on file, drop it from
// the pickable list entirely - re-adding one is a "Remove, then upload
// again" flow via the table above, not a re-select-the-same-type-here flow.
// LD_PROOF/AWARD_PROOF are never in SELECTABLE_DOCUMENT_TYPES to begin with
// (per-entry, unlimited, handled in their own sections), and OTHER always
// stays available since it's a genuine multi-file catch-all.
function computeAvailableTypes(items: ApplicantDocument[]): DocumentType[] {
  return SELECTABLE_DOCUMENT_TYPES.filter(
    (t) => !(SINGLE_INSTANCE_TYPES.has(t) && items.some((doc) => doc.type === t)),
  );
}

export function DocumentsSection({ items, onChange }: Props) {
  const toast = useToast();
  const [type, setType] = useState<DocumentType>(() => computeAvailableTypes(items)[0] ?? "OTHER");
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
      const isReplacing = SINGLE_INSTANCE_TYPES.has(type) && items.some((doc) => doc.type === type);
      const uploaded = await uploadDocument(file, type);
      // The backend already deleted the old row for a single-instance type -
      // drop it from local state too so the table doesn't keep showing a
      // now-nonexistent duplicate until the next full reload.
      const newItems = [uploaded, ...items.filter((doc) => !(isReplacing && doc.type === type))];
      onChange(newItems);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`${DOCUMENT_TYPE_LABELS[type]} ${isReplacing ? "replaced" : "uploaded"}.`);
      // The just-uploaded type may no longer be selectable (single-instance,
      // now satisfied) - move the dropdown to the next available type so its
      // controlled value always matches a rendered option.
      const stillAvailable = computeAvailableTypes(newItems);
      if (!stillAvailable.includes(type) && stillAvailable.length > 0) {
        setType(stillAvailable[0]!);
      }
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
        Please prepare and upload the following documents. Items marked "Required" must be uploaded before you can
        finish registration. Uploading a new file for a document type that already has one on file replaces it -
        each of these represents a single current document, not a growing list.
      </p>

      <div className="card-inset" style={{ marginBottom: "1rem" }}>
        <ol>
          {DOCUMENT_CHECKLIST.map((entry) => (
            <li key={entry.type} style={{ marginBottom: "0.5rem" }}>
              <strong>{DOCUMENT_TYPE_LABELS[entry.type]}</strong>{" "}
              {entry.required ? (
                <span className="badge pending">Required</span>
              ) : (
                <span className="badge">Optional{entry.note ? ` — ${entry.note}` : ""}</span>
              )}
              {entry.type === "APPLICATION_LETTER" && (
                <p className="field-hint" style={{ marginTop: "0.4rem", whiteSpace: "pre-line" }}>
                  Addressed to:{"\n"}
                  ARNEL M. AGABE, CESO III{"\n"}
                  Regional Director{"\n"}
                  DILG Regional Office 8{"\n"}
                  Kanhuraw Hill, Tacloban City{"\n\n"}
                  Thru:{"\n"}
                  JANE A. VILLANUEVA{"\n"}
                  LGOO V / Head, Human Resource Section
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

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
            {computeAvailableTypes(items).map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Types already on file are removed from this list - use "Remove" below to replace one.
          </p>
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
