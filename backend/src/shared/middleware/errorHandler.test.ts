import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "./errorHandler";

function fakeResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const fakeRequest = { path: "/api/whatever" } as Request;

describe("errorHandler", () => {
  it("maps a malformed-JSON body-parse SyntaxError to 400, not the generic 500", () => {
    // express.json() throws exactly this shape - a SyntaxError with
    // .status/.statusCode 400 set by body-parser - when the request body
    // isn't valid JSON. Before this fix it fell through to the generic 500
    // branch (see docs/decisions.md / audit finding F-05).
    const bodyParseError = Object.assign(new SyntaxError("Unexpected token in JSON"), { status: 400, body: "{bad" });
    const res = fakeResponse();

    errorHandler(bodyParseError, fakeRequest, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: "VALIDATION_ERROR", message: "Malformed JSON in request body" } });
  });

  it("still falls through to the generic 500 for an unrelated SyntaxError", () => {
    const res = fakeResponse();

    errorHandler(new SyntaxError("some other syntax error"), fakeRequest, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });
});
