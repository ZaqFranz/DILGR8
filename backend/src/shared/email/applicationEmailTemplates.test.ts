import { describe, expect, it } from "vitest";
import { complianceRequestedEmail, forInterviewEmail, regretEmail, submittedEmail } from "./applicationEmailTemplates";

const MALICIOUS_NAME = '<img src=x onerror=alert(document.cookie)>Juan';

describe("applicationEmailTemplates - HTML injection regression", () => {
  it("submittedEmail escapes an applicant-controlled name", () => {
    const { html } = submittedEmail(MALICIOUS_NAME, "Planning Officer II");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(document.cookie)&gt;Juan");
  });

  it("forInterviewEmail escapes name, venue, attire, and notes", () => {
    const { html } = forInterviewEmail(
      MALICIOUS_NAME,
      "Planning Officer II",
      new Date("2026-09-01T09:00:00Z"),
      '<script>alert("venue")</script>',
      '<b>attire</b>',
      '<i>notes</i>',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>attire</b>");
    expect(html).not.toContain("<i>notes</i>");
    // The structural markup the template itself owns must still render normally.
    expect(html).toContain("<strong>When:</strong>");
    expect(html).toContain("<strong>Where:</strong>");
  });

  it("regretEmail escapes the applicant name and admin-supplied remarks", () => {
    const { html } = regretEmail(
      MALICIOUS_NAME,
      "Planning Officer II",
      "You were not selected.",
      '<img src=x onerror=alert(2)>',
    );
    expect(html).not.toContain("<img");
  });

  it("complianceRequestedEmail escapes each requirement name in the list", () => {
    const { html } = complianceRequestedEmail(MALICIOUS_NAME, "Planning Officer II", [
      "NBI Clearance",
      '<script>alert(3)</script>',
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("NBI Clearance");
  });
});
