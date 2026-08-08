import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { useToast } from "@/shared/components/ToastProvider";
import { listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { JobPosting } from "@/features/job-postings/types";
import { listUsers } from "../api/adminUsersApi";
import { createPanelAssignment, deletePanelAssignment, listPanelAssignments } from "../api/panelAssignmentsApi";
import { AdminShell } from "../components/AdminShell";
import type { AdminUser, PanelAssignment } from "../types";

export function PanelAssignmentsPage() {
  const toast = useToast();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<string>("");
  const [panelUsers, setPanelUsers] = useState<AdminUser[]>([]);
  const [assignments, setAssignments] = useState<PanelAssignment[]>([]);
  const [loadingPostings, setLoadingPostings] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<PanelAssignment | null>(null);
  const [busyPanelUserId, setBusyPanelUserId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listJobPostings(), listUsers({ role: "PANEL" })])
      .then(([loadedPostings, loadedPanelUsers]) => {
        setPostings(loadedPostings);
        setPanelUsers(loadedPanelUsers);
        if (loadedPostings.length > 0) {
          setSelectedPostingId(loadedPostings[0]!.id);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoadingPostings(false));
  }, []);

  useEffect(() => {
    if (!selectedPostingId) {
      setAssignments([]);
      return;
    }
    setLoadingAssignments(true);
    listPanelAssignments(selectedPostingId)
      .then(setAssignments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load panel assignments"))
      .finally(() => setLoadingAssignments(false));
  }, [selectedPostingId]);

  async function handleAssign(panelUserId: string) {
    setError(null);
    setBusyPanelUserId(panelUserId);
    try {
      const created = await createPanelAssignment(selectedPostingId, panelUserId);
      setAssignments((prev) => [...prev, created]);
      toast.success(`${created.panelUser.email} was added to the interview panel.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign panel member");
    } finally {
      setBusyPanelUserId(null);
    }
  }

  async function handleUnassign() {
    if (!pendingUnassign) return;
    setError(null);
    try {
      await deletePanelAssignment(pendingUnassign.id);
      setAssignments((prev) => prev.filter((a) => a.id !== pendingUnassign.id));
      toast.success(`${pendingUnassign.panelUser.email} was removed from the interview panel.`);
      setPendingUnassign(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to unassign panel member");
    }
  }

  if (loadingPostings) {
    return (
      <AdminShell>
        <LoadingBlock label="Loading job postings..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>Interview Panel</h1>
      <p>Assign Panel accounts to a job posting's interview board. Only assigned panelists can score applicants for that posting.</p>
      <ErrorBanner message={error} />

      {postings.length === 0 && <p>No job postings exist yet. Post one first.</p>}

      {postings.length > 0 && (
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="posting-select">Job posting</label>
          <select id="posting-select" value={selectedPostingId} onChange={(e) => setSelectedPostingId(e.target.value)}>
            {postings.map((posting) => (
              <option key={posting.id} value={posting.id}>
                {posting.title} ({posting.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {panelUsers.length === 0 && !loadingPostings && (
        <p>No Panel accounts exist yet. Create one in Users Management first.</p>
      )}

      {loadingAssignments && <LoadingBlock label="Loading panel assignments..." />}

      {!loadingAssignments && selectedPostingId && panelUsers.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Panel member</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {panelUsers.map((panelUser) => {
                const assignment = assignments.find((a) => a.panelUserId === panelUser.id);
                return (
                  <tr key={panelUser.id}>
                    <td>{panelUser.email}</td>
                    <td>
                      <span className={`badge ${assignment ? "open" : "closed"}`}>
                        {assignment ? "Assigned" : "Not assigned"}
                      </span>
                    </td>
                    <td>
                      <div className="data-table-actions">
                        {assignment ? (
                          <button type="button" className="danger" onClick={() => setPendingUnassign(assignment)}>
                            Unassign
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary"
                            disabled={busyPanelUserId === panelUser.id}
                            onClick={() => handleAssign(panelUser.id)}
                          >
                            {busyPanelUserId === panelUser.id ? "Assigning..." : "Assign"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingUnassign !== null}
        title="Unassign panel member?"
        description={
          <>
            <strong>{pendingUnassign?.panelUser.email}</strong> will no longer be able to see or score applicants
            for this posting. Any scores they already submitted are kept.
          </>
        }
        confirmLabel="Unassign"
        onConfirm={handleUnassign}
        onCancel={() => setPendingUnassign(null)}
      />
    </AdminShell>
  );
}
