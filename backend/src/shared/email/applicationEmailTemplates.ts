import { escapeHtml } from "@/shared/utils/escapeHtml";

type EvaluationDecision = "QUALIFIED" | "NOT_QUALIFIED";

interface EmailContent {
  subject: string;
  html: string;
}

const FOOTER = "<p>This is an automated message from DILGR8RSP - please do not reply to this email.</p>";

export function submittedEmail(applicantName: string, jobTitle: string): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  return {
    subject: `Application received - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>We've received your application for <strong>${title}</strong>. You can track its status anytime under My Applications.</p>${FOOTER}`,
  };
}

const INTERVIEW_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "full",
  timeStyle: "short",
};

export function forInterviewEmail(
  applicantName: string,
  jobTitle: string,
  scheduledAt: Date,
  venue: string,
  attire?: string,
  notes?: string,
  scheduledEndAt?: Date,
): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  const formattedStart = new Intl.DateTimeFormat("en-PH", INTERVIEW_DATE_FORMAT).format(scheduledAt);
  const whenDetail = scheduledEndAt
    ? `Day 1: ${formattedStart}; Day 2: ${new Intl.DateTimeFormat("en-PH", INTERVIEW_DATE_FORMAT).format(scheduledEndAt)}`
    : formattedStart;
  const details = [
    `<li><strong>When:</strong> ${whenDetail}</li>`,
    `<li><strong>Where:</strong> ${escapeHtml(venue)}</li>`,
    attire ? `<li><strong>What to wear:</strong> ${escapeHtml(attire)}</li>` : "",
    notes ? `<li><strong>Additional instructions:</strong> ${escapeHtml(notes)}</li>` : "",
  ].join("");

  return {
    subject: `You've been scheduled for evaluation - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>Your application for <strong>${title}</strong> has moved to the Evaluation of Applicants stage. Details:</p><ul>${details}</ul>${FOOTER}`,
  };
}

export function decisionEmail(applicantName: string, jobTitle: string, decision: EvaluationDecision): EmailContent {
  if (decision === "QUALIFIED") {
    const name = escapeHtml(applicantName);
    const title = escapeHtml(jobTitle);
    return {
      subject: `You've been qualified - ${jobTitle}`,
      html: `<p>Hi ${name},</p><p>Congratulations - you've met the qualification standards for <strong>${title}</strong> and are invited to take the DILG Pre-Qualifying Examination (PQE). Schedule details will follow separately.</p>${FOOTER}`,
    };
  }
  return regretEmail(
    applicantName,
    jobTitle,
    `After review, your application for <strong>${escapeHtml(jobTitle)}</strong> was marked <strong>not qualified</strong> against the position's qualification standards.`,
  );
}

/**
 * The single "regret letter" used everywhere an applicant fails to advance
 * to the pipeline's next step - Sifting (decisionEmail's NOT_QUALIFIED
 * branch above), the panel evaluation (rejectAfterInterview), and Compliance
 * to Requirements (rejectAfterCompliance) all route through this one
 * template so the applicant hears the same voice regardless of which stage
 * turned them down. `reason` is the one sentence specific to that stage -
 * already-built HTML (its own interpolated values are pre-escaped by the
 * caller, see decisionEmail above and rejectAfterInterview/
 * rejectAfterCompliance in applications.service.ts), so it's used as-is
 * rather than double-escaped. `remarks` is the admin's optional free-text
 * note for that decision and is escaped here since it never passes through
 * a caller that already did.
 */
export function regretEmail(applicantName: string, jobTitle: string, reason: string, remarks?: string): EmailContent {
  const name = escapeHtml(applicantName);
  return {
    subject: `Application update - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>${reason}</p>${remarks ? `<p>${escapeHtml(remarks)}</p>` : ""}<p>We appreciate the time and effort you invested in this process and encourage you to apply again for future DILG opportunities that match your qualifications.</p>${FOOTER}`,
  };
}

export function examScoreEmail(applicantName: string, jobTitle: string, score: number): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  return {
    subject: `Your PQE result - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>Your Pre-Qualifying Examination score for <strong>${title}</strong> has been recorded: <strong>${score}</strong>.</p>${FOOTER}`,
  };
}

export function withdrawnEmail(applicantName: string, jobTitle: string): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  return {
    subject: `Application withdrawn - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>Your application for <strong>${title}</strong> has been withdrawn at your request. If this was a mistake, you'll need to submit a new application while the posting is still open.</p>${FOOTER}`,
  };
}

export function complianceRequestedEmail(applicantName: string, jobTitle: string, requirementNames: string[]): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  const list =
    requirementNames.length > 0
      ? `<ul>${requirementNames.map((reqName) => `<li>${escapeHtml(reqName)}</li>`).join("")}</ul>`
      : "";
  return {
    subject: `Compliance requirements - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>You've been selected for appointment to <strong>${title}</strong>. Before proceeding to oath-taking, please comply with the following documentary requirements (as mandated by the Civil Service Commission):</p>${list}<p>Upload proof of each requirement under My Applications once ready.</p>${FOOTER}`,
  };
}

const OATH_TAKING_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "full",
  timeStyle: "short",
};

export function oathTakingScheduledEmail(
  applicantName: string,
  jobTitle: string,
  scheduledAt: Date,
  venue: string,
  notes?: string,
): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  const details = [
    `<li><strong>When:</strong> ${new Intl.DateTimeFormat("en-PH", OATH_TAKING_DATE_FORMAT).format(scheduledAt)}</li>`,
    `<li><strong>Where:</strong> ${escapeHtml(venue)}</li>`,
    notes ? `<li><strong>Additional instructions:</strong> ${escapeHtml(notes)}</li>` : "",
  ].join("");

  return {
    subject: `Oath-taking invitation - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>You've complied with every documentary requirement for <strong>${title}</strong> and are invited to the oath-taking ceremony. Details:</p><ul>${details}</ul>${FOOTER}`,
  };
}

export function hiredEmail(applicantName: string, jobTitle: string): EmailContent {
  const name = escapeHtml(applicantName);
  const title = escapeHtml(jobTitle);
  return {
    subject: `Welcome to DILG - ${jobTitle}`,
    html: `<p>Hi ${name},</p><p>Congratulations - you've completed the oath-taking ceremony for <strong>${title}</strong> and are now officially part of DILG. Onboarding details will follow separately.</p>${FOOTER}`,
  };
}
