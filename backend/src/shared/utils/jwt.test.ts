import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { signAccessToken, verifyAccessToken } from "./jwt";

describe("jwt", () => {
  it("round-trips every claim, including tokenVersion", () => {
    const token = signAccessToken({ sub: "user-1", role: "ADMIN", email: "admin@example.com", tokenVersion: 3 });
    const payload = verifyAccessToken(token);
    expect(payload).toMatchObject({ sub: "user-1", role: "ADMIN", email: "admin@example.com", tokenVersion: 3 });
  });

  it("rejects a token signed with a different algorithm than HS256", () => {
    // None of this app's tokens are ever meant to use anything but HS256 -
    // this simulates an attacker (or a future misconfiguration) trying to
    // slip one through, which verifyAccessToken's pinned `algorithms: ["HS256"]`
    // option should reject regardless of whether the signature itself checks out.
    const noneAlgToken = jwt.sign(
      { sub: "user-1", role: "ADMIN", email: "admin@example.com", tokenVersion: 0 },
      "",
      { algorithm: "none" },
    );
    expect(() => verifyAccessToken(noneAlgToken)).toThrow();
  });

  it("rejects a token signed with the wrong secret", () => {
    const forged = jwt.sign(
      { sub: "user-1", role: "ADMIN", email: "admin@example.com", tokenVersion: 0 },
      "a-completely-different-secret-value",
      { algorithm: "HS256" },
    );
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(
      { sub: "user-1", role: "ADMIN", email: "admin@example.com", tokenVersion: 0 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: -10 },
    );
    expect(() => verifyAccessToken(expired)).toThrow();
  });
});
