import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { usePagination } from "@/shared/utils/usePagination";
import { listApplicationsForAdmin } from "../api/adminApplicationsApi";
import {
  createApplicantGroup,
  deleteApplicantGroup,
  listApplicantGroups,
  updateApplicantGroup,
} from "../api/applicantGroupsApi";
import { AdminShell } from "../components/AdminShell";
import type { AdminApplication, ApplicantGroup } from "../types";

interface GroupFormState {
  name: string;
  description: string;
}

const emptyForm: GroupFormState = { name: "", description: "" };

function matchesSearch(application: AdminApplication, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const name = `${application.applicant.firstName} ${application.applicant.lastName}`.toLowerCase();
  return name.includes(term) || application.applicant.user.email.toLowerCase().includes(term);
}

export function GroupsPage() {
  const toast = useToast();
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [groups, setGroups] = useState<ApplicantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [jobPostingFilter, setJobPostingFilter] = useState("");
  const [publicationFilter, setPublicationFilter] = useState("");

  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(new Set());

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ApplicantGroup | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<ApplicantGroup | null>(null);

  // Non-null while the admin is adjusting an existing group's roster via the
  // applicant table's checkboxes (rather than picking members for a brand
  // new group) - repurposes the same bulk-action-bar button/selection
  // mechanism instead of a separate member picker widget.
  const [membershipEditingGroup, setMembershipEditingGroup] = useState<ApplicantGroup | null>(null);
  const [savingMembers, setSavingMembers] = useState(false);

  const applicationsPagination = usePagination(
    applications.filter(
      (app) =>
        (jobPostingFilter === "" || app.jobPosting.id === jobPostingFilter) &&
        (publicationFilter === "" || app.jobPosting.publication === publicationFilter) &&
        matchesSearch(app, search),
    ),
    10,
  );
  const groupsPagination = usePagination(groups, 10);

  const loadAll = useCallback(async () => {
    const [loadedApplications, loadedGroups] = await Promise.all([listApplicationsForAdmin(), listApplicantGroups()]);
    setApplications(loadedApplications);
    setGroups(loadedGroups);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [loadAll]);

  const publicationOptions = [...new Set(applications.map((app) => app.jobPosting.publication))].sort();
  const jobPostingOptions = [...new Map(applications.map((app) => [app.jobPosting.id, app.jobPosting])).values()].sort(
    (a, b) => a.title.localeCompare(b.title),
  );

  const filteredApplications = applicationsPagination.pageItems;
  const pageItemIds = filteredApplications.map((application) => application.id);
  const allOnPageSelected = pageItemIds.length > 0 && pageItemIds.every((id) => selectedApplicationIds.has(id));
  const someOnPageSelected = pageItemIds.some((id) => selectedApplicationIds.has(id));
  const selectedApplications = applications.filter((application) => selectedApplicationIds.has(application.id));

  // Which groups (by name) each application already belongs to - shown as a
  // column so an admin can see existing groupings at a glance while
  // selecting the next batch, the same role "Assigned Panel" plays on the
  // Interview Panel page.
  const groupNamesByApplicationId = new Map<string, string[]>();
  for (const group of groups) {
    for (const member of group.members) {
      const existing = groupNamesByApplicationId.get(member.applicationId) ?? [];
      existing.push(group.name);
      groupNamesByApplicationId.set(member.applicationId, existing);
    }
  }

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

  function startEditMembers(group: ApplicantGroup) {
    setMembershipEditingGroup(group);
    setSelectedApplicationIds(new Set(group.members.map((member) => member.applicationId)));
    setError(null);
  }

  function cancelEditMembers() {
    setMembershipEditingGroup(null);
    clearSelection();
  }

  async function handleSaveMembers() {
    if (!membershipEditingGroup) return;
    setError(null);
    setSavingMembers(true);
    try {
      const updated = await updateApplicantGroup(membershipEditingGroup.id, {
        applicationIds: [...selectedApplicationIds],
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      toast.success(`Updated "${updated.name}"'s members (${updated.members.length} applicant(s)).`);
      setMembershipEditingGroup(null);
      clearSelection();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update group members");
    } finally {
      setSavingMembers(false);
    }
  }

  function openCreateGroupModal() {
    setEditingGroup(null);
    setForm(emptyForm);
    setModalError(null);
    setFieldErrors({});
    setGroupModalOpen(true);
  }

  function openEditGroupModal(group: ApplicantGroup) {
    setEditingGroup(group);
    setForm({ name: group.name, description: group.description ?? "" });
    setModalError(null);
    setFieldErrors({});
    setGroupModalOpen(true);
  }

  function closeGroupModal() {
    if (saving) return;
    setGroupModalOpen(false);
    setEditingGroup(null);
    setForm(emptyForm);
    setFieldErrors({});
  }

  async function handleSubmitGroup(event: FormEvent) {
    event.preventDefault();
    setModalError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      if (editingGroup) {
        const updated = await updateApplicantGroup(editingGroup.id, {
          name: form.name,
          description: form.description || null,
        });
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        toast.success(`Group "${updated.name}" was updated.`);
      } else {
        const created = await createApplicantGroup({
          name: form.name,
          description: form.description || undefined,
          applicationIds: [...selectedApplicationIds],
        });
        setGroups((prev) => [created, ...prev]);
        toast.success(`Created group "${created.name}" with ${created.members.length} applicant(s).`);
        clearSelection();
      }
      setGroupModalOpen(false);
      setEditingGroup(null);
      setForm(emptyForm);
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setModalError("Failed to save group");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteApplicantGroup(pendingDelete.id);
      setGroups((prev) => prev.filter((g) => g.id !== pendingDelete.id));
      toast.success(`Group "${pendingDelete.name}" was deleted.`);
      if (membershipEditingGroup?.id === pendingDelete.id) {
        cancelEditMembers();
      }
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete group");
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
      <h1>Group</h1>
      <p>
        Group applicants together for Group Dynamics Evaluation. Select at least two applicants below, then create a
        group with a name and description. Use a group's "Members" action to add or remove applicants later using
        the same checkboxes.
      </p>
      <ErrorBanner message={error} />

      {applications.length === 0 && <p>No applications have been submitted yet.</p>}

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
                applicationsPagination.setPage(1);
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
                applicationsPagination.setPage(1);
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
                applicationsPagination.setPage(1);
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
            {membershipEditingGroup ? (
              <span>
                Editing members of <strong>{membershipEditingGroup.name}</strong>: {selectedApplicationIds.size}{" "}
                applicant{selectedApplicationIds.size === 1 ? "" : "s"} selected
              </span>
            ) : selectedApplicationIds.size > 0 ? (
              <span>{selectedApplicationIds.size} applicant{selectedApplicationIds.size === 1 ? "" : "s"} selected</span>
            ) : (
              <span className="muted">Select at least two applicants below to form a group.</span>
            )}
          </div>
          <div className="bulk-action-bar-buttons">
            {membershipEditingGroup ? (
              <>
                <button type="button" className="secondary" disabled={savingMembers} onClick={cancelEditMembers}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedApplicationIds.size < 2 || savingMembers}
                  onClick={handleSaveMembers}
                >
                  {savingMembers && <Spinner size="sm" onDark />}
                  {savingMembers ? "Saving..." : "Save Members"}
                </button>
              </>
            ) : (
              <>
                {selectedApplicationIds.size > 0 && (
                  <button type="button" className="secondary" onClick={clearSelection}>
                    Clear selection
                  </button>
                )}
                <button type="button" disabled={selectedApplicationIds.size < 2} onClick={openCreateGroupModal}>
                  Group
                </button>
              </>
            )}
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
                <th>Group(s)</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No applicants match your search/filter.
                  </td>
                </tr>
              )}
              {filteredApplications.map((application) => {
                const memberOfGroups = groupNamesByApplicationId.get(application.id) ?? [];
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
                      {memberOfGroups.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        memberOfGroups.join(", ")
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={applicationsPagination.page}
            totalPages={applicationsPagination.totalPages}
            totalItems={applicationsPagination.totalItems}
            pageSize={10}
            onPageChange={applicationsPagination.setPage}
          />
        </div>
      )}

      <h2>Groups</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Members</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No groups have been created yet.
                </td>
              </tr>
            )}
            {groupsPagination.pageItems.map((group) => (
              <tr key={group.id}>
                <td>{group.name}</td>
                <td>{group.description || "-"}</td>
                <td>
                  {group.members
                    .map((member) => `${member.application.applicant.firstName} ${member.application.applicant.lastName}`)
                    .join(", ")}
                </td>
                <td>{new Date(group.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="data-table-actions">
                    <button type="button" className="secondary" onClick={() => openEditGroupModal(group)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={membershipEditingGroup?.id === group.id}
                      onClick={() => startEditMembers(group)}
                    >
                      Members
                    </button>
                    <button type="button" className="danger" onClick={() => setPendingDelete(group)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={groupsPagination.page}
          totalPages={groupsPagination.totalPages}
          totalItems={groupsPagination.totalItems}
          pageSize={10}
          onPageChange={groupsPagination.setPage}
        />
      </div>

      <Modal
        open={groupModalOpen}
        title={editingGroup ? "Edit Group" : "Group Selected Applicants"}
        onClose={closeGroupModal}
        footer={
          <>
            <button type="button" className="secondary" disabled={saving} onClick={closeGroupModal}>
              Cancel
            </button>
            <button type="submit" form="group-form" disabled={saving}>
              {saving && <Spinner size="sm" onDark />}
              {saving ? "Saving..." : editingGroup ? "Save" : "Create Group"}
            </button>
          </>
        }
      >
        <form id="group-form" onSubmit={handleSubmitGroup} noValidate>
          {!editingGroup && (
            <p className="field-hint">
              Creating a group of <strong>{selectedApplications.length}</strong> applicant
              {selectedApplications.length === 1 ? "" : "s"}: {" "}
              {selectedApplications
                .map((app) => `${app.applicant.firstName} ${app.applicant.lastName}`)
                .join(", ")}
            </p>
          )}
          <ErrorBanner message={modalError} />
          <div className={fieldErrors.name ? "field has-error" : "field"}>
            <label htmlFor="group-name" className="required">
              Group name
            </label>
            <input
              id="group-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FieldError message={fieldErrors.name} />
          </div>
          <div className={fieldErrors.description ? "field has-error" : "field"}>
            <label htmlFor="group-description">Description (optional)</label>
            <textarea
              id="group-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <FieldError message={fieldErrors.description} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete group?"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be permanently deleted. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteGroup}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
