import { useState } from "react";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { EvaluationRow } from "./EvaluationRow";
import { AssignPositionModal } from "./AssignPositionModal";
import type { AdminApplication, TabulationResult } from "../types";

interface Props {
  // This one applicant's applications (2+, already filtered/sorted by the
  // page) - a single-application applicant renders a plain <EvaluationRow>
  // directly instead of this component, see EvaluateApplicantsPage.tsx.
  applications: AdminApplication[];
  tabulationByPosting: Record<string, TabulationResult>;
  onSifted: (updated: AdminApplication) => void;
  onScheduled: (updated: AdminApplication) => void;
  onHired: () => void | Promise<void>;
}

/**
 * Collapsed-by-default summary row for one applicant who applied to
 * multiple postings, expanding on click to reveal the same per-posting
 * <EvaluationRow>s as before - Sifting/PQE/Schedule-Interview/Compliance
 * stay genuinely per-posting actions (different postings can have
 * different qualification standards), so this only consolidates the
 * *view*, not those actions. See docs/decisions.md's entry on this.
 */
export function ApplicantGroupSummaryRow({ applications, tabulationByPosting, onSifted, onScheduled, onHired }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const first = applications[0]!;
  const applicantName = `${first.applicant.firstName} ${first.applicant.lastName}`;
  // Only postings actually reached Oath-Taking are real candidates for the
  // "assign position" decision - client requirement: this triggers once
  // evaluation + compliance are done, matching the same FOR_OATH_TAKING
  // gate the pipeline already uses for that stage.
  const oathTakingCandidates = applications.filter((application) => application.status === "FOR_OATH_TAKING");
  const canAssignPosition = oathTakingCandidates.length >= 2;

  return (
    <>
      <tr className="applicant-group-summary" onClick={() => setExpanded((prev) => !prev)}>
        <td>
          <span className={`expand-toggle${expanded ? " expanded" : ""}`} aria-hidden="true">
            &#9656;
          </span>
          {applicantName}
        </td>
        <td colSpan={6}>
          Applied to {applications.length} postings:{" "}
          {applications.map((application) => `${application.jobPosting.title} (${APPLICATION_STATUS_LABELS[application.status]})`).join(", ")}
        </td>
        <td>
          {canAssignPosition && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowAssignModal(true);
              }}
            >
              Assign Position
            </button>
          )}
        </td>
      </tr>
      {expanded &&
        applications.map((application) => (
          <EvaluationRow
            key={application.id}
            application={application}
            onSifted={onSifted}
            onScheduled={onScheduled}
            tabulation={
              tabulationByPosting[application.jobPosting.id]?.rows.find((row) => row.applicationId === application.id) ?? null
            }
            panelists={tabulationByPosting[application.jobPosting.id]?.panelists ?? []}
            disableMarkHired={application.status === "FOR_OATH_TAKING" && canAssignPosition}
            onHired={onHired}
          />
        ))}
      {showAssignModal && (
        <AssignPositionModal
          applicantName={applicantName}
          candidates={oathTakingCandidates}
          onClose={() => setShowAssignModal(false)}
          onAssigned={onHired}
        />
      )}
    </>
  );
}
