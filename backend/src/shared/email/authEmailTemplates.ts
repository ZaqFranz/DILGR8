interface EmailContent {
  subject: string;
  html: string;
}

const FOOTER = "<p>This is an automated message from DILGR8RSP - please do not reply to this email.</p>";

export function temporaryPasswordEmail(applicantName: string, temporaryPassword: string): EmailContent {
  return {
    subject: "Your temporary DILGR8RSP password",
    html: `<p>Hi ${applicantName},</p><p>We received a request to reset your DILGR8RSP password. Use the temporary password below to log in:</p><p style="font-size:1.25rem;font-weight:bold;letter-spacing:2px;">${temporaryPassword}</p><p>You'll be asked to set a new password immediately after logging in. If you didn't request this, you can ignore this email - your password won't change until someone logs in with the temporary one above.</p>${FOOTER}`,
  };
}
