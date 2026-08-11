import { Fragment, type ReactNode, type SVGProps } from "react";
import type { Application } from "../api/applicationsApi";

type ApplicationStatus = Application["status"];

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const STAGE_ORDER: { key: string; label: string }[] = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_SIFTING", label: "Sifting" },
  { key: "EXAMINATION", label: "Pre-Qualifying Examination" },
  { key: "FOR_INTERVIEW", label: "Evaluation of Applicants" },
  { key: "FOR_COMPLIANCE", label: "Compliance to Requirements" },
  { key: "FOR_OATH_TAKING", label: "Oath-Taking" },
  { key: "HIRED", label: "Hired" },
];

// QUALIFIED/NOT_QUALIFIED is the Sifting phase's pass/fail result (against
// the posting's qualification standards), not a final decision - it happens
// here, mid-pipeline, well before the PQE and interview. NOT_QUALIFIED is
// terminal (rejected at sifting); QUALIFIED continues on to Examination/
// Interview, so it maps past the Sifting node rather than resolving on it.
const STATUS_TO_STAGE_INDEX: Record<ApplicationStatus, number> = {
  SUBMITTED: 0,
  UNDER_SIFTING: 1,
  NOT_QUALIFIED: 1,
  QUALIFIED: 2,
  FOR_INTERVIEW: 3,
  FOR_COMPLIANCE: 4,
  FOR_OATH_TAKING: 5,
  HIRED: 6,
  WITHDRAWN: -1, // handled separately, not part of the linear stepper
};

interface Props {
  status: ApplicationStatus;
}

/**
 * Visual progress stepper mirroring the RSP pipeline's ApplicationStatus
 * enum. WITHDRAWN can happen from any prior stage and isn't "further
 * along" than the others, so it bypasses the linear stepper entirely
 * rather than forcing it into one of the four nodes.
 */
export function ApplicationStageTracker({ status }: Props) {
  if (status === "WITHDRAWN") {
    return (
      <div className="stage-tracker stage-tracker--withdrawn">
        <span className="stage-tracker-circle withdrawn">
          <XIcon width={14} height={14} />
        </span>
        <span className="stage-tracker-label current">Application withdrawn</span>
      </div>
    );
  }

  const currentIndex = STATUS_TO_STAGE_INDEX[status];

  return (
    <div className="stage-tracker">
      {STAGE_ORDER.map((stage, i) => {
        const isSifting = stage.key === "UNDER_SIFTING";
        const reached = i <= currentIndex;
        const isCurrent = i === currentIndex;

        let circleClass = "stage-tracker-circle";
        let label = stage.label;
        let content: ReactNode = i + 1;

        if (isSifting && isCurrent && status === "NOT_QUALIFIED") {
          circleClass += " not-qualified";
          label = "Not Qualified";
          content = <XIcon width={14} height={14} />;
        } else if (reached && !isCurrent) {
          circleClass += " completed";
          content = <CheckIcon width={14} height={14} />;
        } else if (isCurrent) {
          // Each in-progress stage keeps the same color as its own badge
          // elsewhere in the app (submitted/under_sifting/for_interview),
          // rather than one generic "current" color for all three.
          circleClass += ` current current-${stage.key.toLowerCase()}`;
        }

        return (
          <Fragment key={stage.key}>
            {i > 0 && <div className={`stage-tracker-line${i <= currentIndex ? " filled" : ""}`} />}
            <div className="stage-tracker-node">
              <span className={circleClass}>{content}</span>
              <span className={`stage-tracker-label${reached ? " reached" : ""}`}>{label}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
