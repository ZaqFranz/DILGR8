import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { usePagination } from "@/shared/utils/usePagination";
import { groupByApplicant } from "@/shared/utils/groupByApplicant";
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

  // Every one of this applicant's own applications, not just one posting -
  // client requirement: an applicant's postings must never end up with
  // different assigned panels, so there is deliberately no way to open this
  // modal scoped to just one of their postings (see handleSaveAssignment,
  // which applies the exact same panelist list to all of them at once).
  const [assigningGroup, setAssigningGroup] = useState<AdminApplication[] | null>(null);
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
  // Grouped by applicant so a multi-posting applicant shows as one row - the
  // underlying selection/bulk-assign machinery below still operates on
  // every one of that applicant's own application ids at once (unlike
  // Groups, an assignment target really is the posting behind each
  // application, so including all of them is correct here, not a bug).
  const filteredGroups = groupByApplicant(filteredApplications, (app) => app.applicant.id);
  const pagination = usePagination(filteredGroups, 10);

  const pageApplicationIds = pagination.pageItems.flatMap((group) => group.rows.map((app) => app.id));
  const allOnPageSelected = pageApplicationIds.length > 0 && pageApplicationIds.every((id) => selectedApplicationIds.has(id));
  const someOnPageSelected = pageApplicationIds.some((id) => selectedApplicationIds.has(id));
  const selectedApplications = applications.filter((application) => selectedApplicationIds.has(application.id));
  const selectedJobPostingIds = [...new Set(selectedApplications.map((application) => application.jobPosting.id))];
  // Distinct people, not applications - a multi-posting applicant's row
  // adds all of their application ids to selectedApplicationIds at once, so
  // that count alone would overstate how many people are actually selected.
  const selectedApplicantCount = new Set(selectedApplications.map((application) => application.applicant.id)).size;

  function toggleApplicantSelected(applicationIds: string[], checked: boolean) {
    setSelectedApplicationIds((prev) => {
      const next = new Set(prev);
      applicationIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function togglePageSelected(checked: boolean) {
    setSelectedApplicationIds((prev) => {
      const next = new Set(prev);
      pageApplicationIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function clearSelection() {
    setSelectedApplicationIds(new Set());
  }

  function openAssignModal(group: AdminApplication[]) {
    setAssigningGroup(group);
    // Pre-filled with the union of whoever's currently assigned across any
    // of this applicant's postings, so an admin picking up an
    // already-divergent assignment (from before this fix) sees everyone
    // who was there rather than silently losing someone on save.
    const union = new Set<string>();
    for (const application of group) {
      for (const assignment of assignmentsByPosting[application.jobPosting.id] ?? []) {
        union.add(assignment.panelUserId);
      }
    }
    setSelectedPanelUserIds([...union]);
    setModalError(null);
  }

  function closeAssignModal() {
    if (saving) return;
    setAssigningGroup(null);
    setSelectedPanelUserIds([]);
    setModalError(null);
  }

  function togglePanelUser(panelUserId: string, checked: boolean) {
    setSelectedPanelUserIds((prev) =>
      checked ? [...prev, panelUserId] : prev.filter((id) => id !== panelUserId),
    );
  }

  async function handleSaveAssignment() {
    if (!assigningGroup) return;
    const applicantName = `${assigningGroup[0]!.applicant.firstName} ${assigningGroup[0]!.applicant.lastName}`;

    setModalError(null);
    setSaving(true);
    try {
      // The exact same selectedPanelUserIds list is applied to every one of
      // this applicant's postings - the whole point being fixed here is
      // that their postings can never end up with different panels.
      const results = await Promise.all(
        assigningGroup.map(async (application) => {
          const jobPostingId = application.jobPosting.id;
          const current = assignmentsByPosting[jobPostingId] ?? [];
          const toAdd = selectedPanelUserIds.filter((id) => !current.some((a) => a.panelUserId === id));
          const toRemove = current.filter((a) => !selectedPanelUserIds.includes(a.panelUserId));
          const [added] = await Promise.all([
            Promise.all(toAdd.map((panelUserId) => createPanelAssignment(jobPostingId, panelUserId))),
            Promise.all(toRemove.map((assignment) => deletePanelAssignment(assignment.id))),
          ]);
          const removedIds = new Set(toRemove.map((a) => a.id));
          return { jobPostingId, next: [...current.filter((a) => !removedIds.has(a.id)), ...added] };
        }),
      );
      setAssignmentsByPosting((prev) => {
        const next = { ...prev };
        for (const result of results) next[result.jobPostingId] = result.next;
        return next;
      });
      toast.success(
        assigningGroup.length > 1
          ? `Interview panel updated for ${applicantName}'s ${assigningGroup.length} postings.`
          : `Interview panel updated for "${assigningGroup[0]!.jobPosting.title}".`,
      );
      setAssigningGroup(null);
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
                {selectedApplicantCount} applicant{selectedApplicantCount === 1 ? "" : "s"} selected
                {" across "}
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
              {pagination.pageItems.map((group) => {
                const first = group.rows[0]!;
                const applicationIds = group.rows.map((app) => app.id);
                const groupSelected = applicationIds.every((id) => selectedApplicationIds.has(id));
                return (
                  <tr key={group.key}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${first.applicant.firstName} ${first.applicant.lastName}`}
                        checked={groupSelected}
                        onChange={(e) => toggleApplicantSelected(applicationIds, e.target.checked)}
                      />
                    </td>
                    <td>
                      {first.applicant.firstName} {first.applicant.lastName}
                    </td>
                    <td>{first.applicant.user.email}</td>
                    <td>{group.rows.map((app) => app.jobPosting.title).join(", ")}</td>
                    <td>{new Date(first.submittedAt).toLocaleDateString()}</td>
                    <td>
                      {group.rows.map((app) => {
                        const assigned = assignmentsByPosting[app.jobPosting.id] ?? [];
                        return (
                          <div key={app.id} className="posting-status-line">
                            {group.rows.length > 1 && <strong>{app.jobPosting.title}: </strong>}
                            {assigned.length === 0 ? (
                              <span className="muted">None assigned</span>
                            ) : (
                              assigned.map((a) => formatUserDisplayName(a.panelUser)).join(", ")
                            )}
                          </div>
                        );
                      })}
                    </td>
                    <td>
                      <div className="data-table-actions data-table-actions--uniform">
                        <button
                          type="button"
                          className="secondary"
                          disabled={panelUsers.length === 0}
                          onClick={() => openAssignModal(group.rows)}
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
        open={assigningGroup !== null}
        title={
          assigningGroup
            ? `Assign Panel: ${assigningGroup[0]!.applicant.firstName} ${assigningGroup[0]!.applicant.lastName}`
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
        {assigningGroup && (
          <>
            <p className="field-hint">
              {assigningGroup.length > 1 ? (
                <>
                  For <strong>all {assigningGroup.length} postings</strong> this applicant applied to (
                  {assigningGroup.map((app) => app.jobPosting.title).join(", ")}) - an applicant's postings always
                  share the same interview panel, so this can't be set differently per posting. Every panelist checked
                  below will be able to see and score every applicant under each of these postings, not just this one.
                </>
              ) : (
                <>
                  For job posting <strong>{assigningGroup[0]!.jobPosting.title}</strong>. Every panelist checked below
                  will be able to see and score every applicant under this posting, not just this one.
                </>
              )}
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
        title={`Assign Panel to ${selectedApplicantCount} Applicant${selectedApplicantCount === 1 ? "" : "s"}`}
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
