import { useState } from "react";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { EvaluationRow } from "./EvaluationRow";
import type { AdminApplication, TabulationResult } from "../types";

interface Props {
  // This one applicant's applications (2+), whose statuses have diverged
  // (not all the same) - EvaluateApplicantsPage only reaches for this
  // component in that case; a status-uniform group (the everyday case,
  // including every single-posting applicant) renders one <EvaluationRow>
  // directly instead, with every action applying to the whole group at
  // once. Divergence should only ever come from data older than that
  // feature - this exists purely so an out-of-sync group still has a way
  // to be viewed/acted on per posting rather than silently losing its
  // action buttons. See docs/decisions.md.
  applications: AdminApplication[];
  tabulationByPosting: Record<string, TabulationResult>;
  onSifted: (updated: AdminApplication) => void;
  onScheduled: (updated: AdminApplication) => void;
  onHired: () => void | Promise<void>;
}

export function ApplicantGroupSummaryRow({ applications, tabulationByPosting, onSifted, onScheduled, onHired }: Props) {
  const [expanded, setExpanded] = useState(false);

  const first = applications[0]!;
  const applicantName = `${first.applicant.firstName} ${first.applicant.lastName}`;

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
          Out of sync across {applications.length} postings, reviewing individually:{" "}
          {applications.map((application) => `${application.jobPosting.title} (${APPLICATION_STATUS_LABELS[application.status]})`).join(", ")}
        </td>
        <td></td>
      </tr>
      {expanded &&
        applications.map((application) => (
          <EvaluationRow
            key={application.id}
            applications={[application]}
            tabulationByPosting={tabulationByPosting}
            onSifted={onSifted}
            onScheduled={onScheduled}
            onHired={onHired}
          />
        ))}
    </>
  );
}
