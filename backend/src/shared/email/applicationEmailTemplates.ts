type EvaluationDecision = "QUALIFIED" | "NOT_QUALIFIED";

interface EmailContent {
  subject: string;
  html: string;
}

const FOOTER = "<p>This is an automated message from DILGR8RSP - please do not reply to this email.</p>";

export function submittedEmail(applicantName: string, jobTitle: string): EmailContent {
  return {
    subject: `Application received - ${jobTitle}`,
    html: `<p>Hi ${applicantName},</p><p>We've received your application for <strong>${jobTitle}</strong>. You can track its status anytime under My Applications.</p>${FOOTER}`,
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
  const formattedStart = new Intl.DateTimeFormat("en-PH", INTERVIEW_DATE_FORMAT).format(scheduledAt);
  const whenDetail = scheduledEndAt
    ? `Day 1: ${formattedStart}; Day 2: ${new Intl.DateTimeFormat("en-PH", INTERVIEW_DATE_FORMAT).format(scheduledEndAt)}`
    : formattedStart;
  const details = [
    `<li><strong>When:</strong> ${whenDetail}</li>`,
    `<li><strong>Where:</strong> ${venue}</li>`,
    attire ? `<li><strong>What to wear:</strong> ${attire}</li>` : "",
    notes ? `<li><strong>Additional instructions:</strong> ${notes}</li>` : "",
  ].join("");

  return {
    subject: `You've been scheduled for evaluation - ${jobTitle}`,
    html: `<p>Hi ${applicantName},</p><p>Your application for <strong>${jobTitle}</strong> has moved to the Evaluation of Applicants stage. Details:</p><ul>${details}</ul>${FOOTER}`,
  };
}

export function decisionEmail(applicantName: string, jobTitle: string, decision: EvaluationDecision): EmailContent {
  if (decision === "QUALIFIED") {
    return {
      subject: `You've been qualified - ${jobTitle}`,
      html: `<p>Hi ${applicantName},</p><p>Congratulations - you've met the qualification standards for <strong>${jobTitle}</strong> and are invited to take the DILG Pre-Qualifying Examination (PQE). Schedule details will follow separately.</p>${FOOTER}`,
    };
  }
  return {
    subject: `Application update - ${jobTitle}`,
    html: `<p>Hi ${applicantName},</p><p>After review, your application for <strong>${jobTitle}</strong> was marked <strong>not qualified</strong> against the position's qualification standards. Thank you for your interest in DILG.</p>${FOOTER}`,
  };
}

export function examScoreEmail(applicantName: string, jobTitle: string, score: number): EmailContent {
  return {
    subject: `Your PQE result - ${jobTitle}`,
    html: `<p>Hi ${applicantName},</p><p>Your Pre-Qualifying Examination score for <strong>${jobTitle}</strong> has been recorded: <strong>${score}</strong>.</p>${FOOTER}`,
  };
}

export function withdrawnEmail(applicantName: string, jobTitle: string): EmailContent {
  return {
    subject: `Application withdrawn - ${jobTitle}`,
    html: `<p>Hi ${applicantName},</p><p>Your application for <strong>${jobTitle}</strong> has been withdrawn at your request. If this was a mistake, you'll need to submit a new application while the posting is still open.</p>${FOOTER}`,
  };
}
