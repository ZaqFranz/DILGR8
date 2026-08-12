import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("neutralizes an injected tag so it can't break out into markup", () => {
    const malicious = '<img src=x onerror=alert(1)>Juan';
    expect(escapeHtml(malicious)).toBe("&lt;img src=x onerror=alert(1)&gt;Juan");
    expect(escapeHtml(malicious)).not.toContain("<img");
  });

  it("neutralizes an attribute-breakout attempt", () => {
    const malicious = `Dela Cruz"><script>alert(1)</script>`;
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("<script>");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Juan Dela Cruz")).toBe("Juan Dela Cruz");
  });
});
