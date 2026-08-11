import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { usePagination } from "@/shared/utils/usePagination";
import { formatUserDisplayName } from "@/shared/utils/formatUserDisplayName";
import { listApplicationsForAdmin } from "../api/adminApplicationsApi";
import { listUsers } from "../api/adminUsersApi";
import {
  bulkCreatePanelAssignments,
  createPanelAssignment,
  deletePanelAssignment,
  listPanelAssignments,
} from "../api/panelAssignmentsApi";
import { AdminShell } from "../components/AdminShell";
import type { AdminApplication, AdminUser, PanelAssignment } from "../types";

function matchesSearch(application: AdminApplication, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const name = `${application.applicant.firstName} ${application.applicant.lastName}`.toLowerCase();
  return name.includes(term) || application.applicant.user.email.toLowerCase().includes(term);
}

export function PanelAssignmentsPage() {
  const toast = useToast();
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [panelUsers, setPanelUsers] = useState<AdminUser[]>([]);
  const [assignmentsByPosting, setAssignmentsByPosting] = useState<Record<string, PanelAssignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [jobPostingFilter, setJobPostingFilter] = useState("");
  const [publicationFilter, setPublicationFilter] = useState("");

  const [assigningApplication, setAssigningApplication] = useState<AdminApplication | null>(null);
  const [selectedPanelUserIds, setSelectedPanelUserIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkPanelUserIds, setBulkPanelUserIds] = useState<string[]>([]);
  const [bulkModalError, setBulkModalError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const [loadedApplications, loadedPanelUsers] = await Promise.all([
      listApplicationsForAdmin(),
      listUsers({ role: "PANEL" }),
    ]);
    setApplications(loadedApplications);
    setPanelUsers(loadedPanelUsers);

    const distinctPostingIds = [...new Set(loadedApplications.map((app) => app.jobPosting.id))];
    const assignmentLists = await Promise.all(distinctPostingIds.map((id) => listPanelAssignments(id)));
    const map: Record<string, PanelAssignment[]> = {};
    distinctPostingIds.forEach((id, i) => {
      map[id] = assignmentLists[i]!;
    });
    setAssignmentsByPosting(map);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [loadAll]);

  // Admin-typed free text, not a fixed list - offer whatever values are
  // actually in use right now as filter choices instead of a hardcoded set.
  const publicationOptions = [...new Set(applications.map((app) => app.jobPosting.publication))].sort();
  // Only offer postings that actually have an application, not every posting
  // in the system - same "only real choices" rule as the Publication filter.
  const jobPostingOptions = [...new Map(applications.map((app) => [app.jobPosting.id, app.jobPosting])).values()].sort(
    (a, b) => a.title.localeCompare(b.title),
  );

  const filteredApplications = applications.filter(
    (app) =>
      (jobPostingFilter === "" || app.jobPosting.id === jobPostingFilter) &&
      (publicationFilter === "" || app.jobPosting.publication === publicationFilter) &&
      matchesSearch(app, search),
  );
  const pagination = usePagination(filteredApplications, 10);

  const pageItemIds = pagination.pageItems.map((application) => application.id);
  const allOnPageSelected = pageItemIds.length > 0 && pageItemIds.every((id) => selectedApplicationIds.has(id));
  const someOnPageSelected = pageItemIds.some((id) => selectedApplicationIds.has(id));
  const selectedApplications = applications.filter((application) => selectedApplicationIds.has(application.id));
  const selectedJobPostingIds = [...new Set(selectedApplications.map((application) => application.jobPosting.id))];

  function toggleApplicationSelected(applicationId: string, checked: boolean) {
    setSelectedApplicationIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(applicationId);
      else next.delete(applicationId);
      return next;
    });
  }

  function togglePageSelected(checked: boolean) {
    setSelectedApplicationIds((prev) => {
      const next = new Set(prev);
      pageItemIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function clearSelection() {
    setSelectedApplicationIds(new Set());
  }

  function openAssignModal(application: AdminApplication) {
    setAssigningApplication(application);
    setSelectedPanelUserIds(
      (assignmentsByPosting[application.jobPosting.id] ?? []).map((assignment) => assignment.panelUserId),
    );
    setModalError(null);
  }

  function closeAssignModal() {
    if (saving) return;
    setAssigningApplication(null);
    setSelectedPanelUserIds([]);
    setModalError(null);
  }

  function togglePanelUser(panelUserId: string, checked: boolean) {
    setSelectedPanelUserIds((prev) =>
      checked ? [...prev, panelUserId] : prev.filter((id) => id !== panelUserId),
    );
  }

  async function handleSaveAssignment() {
    if (!assigningApplication) return;
    const jobPostingId = assigningApplication.jobPosting.id;
    const current = assignmentsByPosting[jobPostingId] ?? [];
    const toAdd = selectedPanelUserIds.filter((id) => !current.some((a) => a.panelUserId === id));
    const toRemove = current.filter((a) => !selectedPanelUserIds.includes(a.panelUserId));

    setModalError(null);
    setSaving(true);
    try {
      const [added] = await Promise.all([
        Promise.all(toAdd.map((panelUserId) => createPanelAssignment(jobPostingId, panelUserId))),
        Promise.all(toRemove.map((assignment) => deletePanelAssignment(assignment.id))),
      ]);
      const removedIds = new Set(toRemove.map((a) => a.id));
      const next = [...current.filter((a) => !removedIds.has(a.id)), ...added];
      setAssignmentsByPosting((prev) => ({ ...prev, [jobPostingId]: next }));
      toast.success(`Interview panel updated for "${assigningApplication.jobPosting.title}".`);
      setAssigningApplication(null);
      setSelectedPanelUserIds([]);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to update interview panel");
    } finally {
      setSaving(false);
    }
  }

  function openBulkAssignModal() {
    setBulkPanelUserIds([]);
    setBulkModalError(null);
    setBulkAssignOpen(true);
  }

  function closeBulkAssignModal() {
    if (bulkSaving) return;
    setBulkAssignOpen(false);
    setBulkPanelUserIds([]);
    setBulkModalError(null);
  }

  function toggleBulkPanelUser(panelUserId: string, checked: boolean) {
    setBulkPanelUserIds((prev) => (checked ? [...prev, panelUserId] : prev.filter((id) => id !== panelUserId)));
  }

  async function handleBulkAssign() {
    if (selectedJobPostingIds.length === 0 || bulkPanelUserIds.length === 0) return;

    setBulkModalError(null);
    setBulkSaving(true);
    try {
      const result = await bulkCreatePanelAssignments(selectedJobPostingIds, bulkPanelUserIds);
      setAssignmentsByPosting((prev) => {
        const next = { ...prev };
        for (const jobPostingId of selectedJobPostingIds) {
          const createdForPosting = result.created.filter((a) => a.jobPostingId === jobPostingId);
          if (createdForPosting.length === 0) continue;
          const current = next[jobPostingId] ?? [];
          next[jobPostingId] = [...current, ...createdForPosting];
        }
        return next;
      });
      const postingCount = selectedJobPostingIds.length;
      toast.success(
        `Added ${bulkPanelUserIds.length} panelist${bulkPanelUserIds.length === 1 ? "" : "s"} to ${postingCount} job posting${postingCount === 1 ? "" : "s"}` +
          (result.skippedCount > 0 ? ` (${result.skippedCount} already assigned).` : "."),
      );
      setBulkAssignOpen(false);
      setBulkPanelUserIds([]);
      clearSelection();
    } catch (err) {
      setBulkModalError(err instanceof ApiError ? err.message : "Failed to bulk-assign interview panel");
    } finally {
      setBulkSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock label="Loading applicants..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>Interview Panel</h1>
      <p>Assign Panel accounts to an applicant's interview board. Only assigned panelists can score applicants for that job posting.</p>
      <ErrorBanner message={error} />

      {applications.length === 0 && <p>No applications have been submitted yet.</p>}

      {panelUsers.length === 0 && applications.length > 0 && (
        <p>No Panel accounts exist yet. Create one in Users Management first.</p>
      )}

      {applications.length > 0 && (
        <div className="filters-row">
          <div className="field">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="search"
              placeholder="Search by applicant name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="job-posting-filter">Job posting</label>
            <select
              id="job-posting-filter"
              value={jobPostingFilter}
              onChange={(e) => {
                setJobPostingFilter(e.target.value);
                pagination.setPage(1);
              }}
            >
              <option value="">All job postings</option>
              {jobPostingOptions.map((jobPosting) => (
                <option key={jobPosting.id} value={jobPosting.id}>
                  {jobPosting.title} ({jobPosting.status})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="publication-filter">Publication</label>
            <select
              id="publication-filter"
              value={publicationFilter}
              onChange={(e) => {
                setPublicationFilter(e.target.value);
                pagination.setPage(1);
              }}
            >
              <option value="">All publications</option>
              {publicationOptions.map((publication) => (
                <option key={publication} value={publication}>
                  {publication}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div className="bulk-action-bar">
          <div>
            {selectedApplicationIds.size > 0 ? (
              <span>
                {selectedApplicationIds.size} applicant{selectedApplicationIds.size === 1 ? "" : "s"} selected
                {" — "}
                {selectedJobPostingIds.length} job posting{selectedJobPostingIds.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="muted">Select applicants below to assign a panel to several at once.</span>
            )}
          </div>
          <div className="bulk-action-bar-buttons">
            {selectedApplicationIds.size > 0 && (
              <button type="button" className="secondary" onClick={clearSelection}>
                Clear selection
              </button>
            )}
            <button
              type="button"
              disabled={selectedApplicationIds.size === 0 || panelUsers.length === 0}
              onClick={openBulkAssignModal}
            >
              Assign Panel to Selected
            </button>
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    aria-label="Select all applicants on this page"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                    }}
                    onChange={(e) => togglePageSelected(e.target.checked)}
                  />
                </th>
                <th>Applicant</th>
                <th>Email</th>
                <th>Job Posting</th>
                <th>Submitted</th>
                <th>Assigned Panel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No applicants match your search/filter.
                  </td>
                </tr>
              )}
              {pagination.pageItems.map((application) => {
                const assigned = assignmentsByPosting[application.jobPosting.id] ?? [];
                return (
                  <tr key={application.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${application.applicant.firstName} ${application.applicant.lastName}`}
                        checked={selectedApplicationIds.has(application.id)}
                        onChange={(e) => toggleApplicationSelected(application.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      {application.applicant.firstName} {application.applicant.lastName}
                    </td>
                    <td>{application.applicant.user.email}</td>
                    <td>{application.jobPosting.title}</td>
                    <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
                    <td>
                      {assigned.length === 0 ? (
                        <span className="muted">None assigned</span>
                      ) : (
                        assigned.map((a) => formatUserDisplayName(a.panelUser)).join(", ")
                      )}
                    </td>
                    <td>
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="secondary"
                          disabled={panelUsers.length === 0}
                          onClick={() => openAssignModal(application)}
                        >
                          Assign Panel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={10}
            onPageChange={pagination.setPage}
          />
        </div>
      )}

      <Modal
        open={assigningApplication !== null}
        title={
          assigningApplication
            ? `Assign Panel — ${assigningApplication.applicant.firstName} ${assigningApplication.applicant.lastName}`
            : "Assign Panel"
        }
        onClose={closeAssignModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={saving} onClick={closeAssignModal}>
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={handleSaveAssignment}>
              {saving && <Spinner size="sm" onDark />}
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        {assigningApplication && (
          <>
            <p className="field-hint">
              For job posting <strong>{assigningApplication.jobPosting.title}</strong>. Every panelist checked below
              will be able to see and score every applicant under this posting, not just this one.
            </p>
            <ErrorBanner message={modalError} />
            <div className="field">
              <label>Panel members</label>
              {panelUsers.length === 0 ? (
                <p className="field-hint">No Panel accounts exist yet.</p>
              ) : (
                <div className="checkbox-group">
                  {panelUsers.map((panelUser) => (
                    <label key={panelUser.id} className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={selectedPanelUserIds.includes(panelUser.id)}
                        onChange={(e) => togglePanelUser(panelUser.id, e.target.checked)}
                      />
                      {formatUserDisplayName(panelUser)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={bulkAssignOpen}
        title={`Assign Panel to ${selectedApplicationIds.size} Applicant${selectedApplicationIds.size === 1 ? "" : "s"}`}
        onClose={closeBulkAssignModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={bulkSaving} onClick={closeBulkAssignModal}>
              Cancel
            </button>
            <button type="button" disabled={bulkSaving || bulkPanelUserIds.length === 0} onClick={handleBulkAssign}>
              {bulkSaving && <Spinner size="sm" onDark />}
              {bulkSaving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <p className="field-hint">
          Covers <strong>{selectedJobPostingIds.length}</strong> job posting
          {selectedJobPostingIds.length === 1 ? "" : "s"}:
        </p>
        <ul className="job-posting-list">
          {selectedJobPostingIds.map((id) => (
            <li key={id}>{applications.find((app) => app.jobPosting.id === id)?.jobPosting.title ?? id}</li>
          ))}
        </ul>
        <ErrorBanner message={bulkModalError} />
        <div className="field">
          <label>Panel members to add</label>
          {panelUsers.length === 0 ? (
            <p className="field-hint">No Panel accounts exist yet.</p>
          ) : (
            <div className="checkbox-group">
              {panelUsers.map((panelUser) => (
                <label key={panelUser.id} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={bulkPanelUserIds.includes(panelUser.id)}
                    onChange={(e) => toggleBulkPanelUser(panelUser.id, e.target.checked)}
                  />
                  {formatUserDisplayName(panelUser)}
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </AdminShell>
  );
}
