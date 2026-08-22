import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertFileContentMatchesMimeType } from "./documents.service";

describe("assertFileContentMatchesMimeType", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "dilgr8rsp-upload-test-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function writeFile(bytes: number[]): Promise<string> {
    const filePath = path.join(dir, "upload.bin");
    await fs.writeFile(filePath, Buffer.from(bytes));
    return filePath;
  }

  it("accepts a real PDF signature claiming to be application/pdf", async () => {
    const filePath = await writeFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    await expect(assertFileContentMatchesMimeType(filePath, "application/pdf")).resolves.toBeUndefined();
  });

  it("rejects a script renamed to spoof application/pdf's Content-Type", async () => {
    // Reproduces the audit finding (F-02): a client can set any
    // Content-Type header it likes regardless of the file's real bytes -
    // this is exactly what a live curl test in the audit exploited by
    // renaming a script to evil.pdf.
    const filePath = await writeFile(Buffer.from("#!/bin/sh\necho pwned\n", "utf-8").toJSON().data);
    await expect(assertFileContentMatchesMimeType(filePath, "application/pdf")).rejects.toThrow(
      "The uploaded file's content does not match its file type",
    );
  });

  it("deletes the rejected file from disk so nothing spoofed is left behind", async () => {
    const filePath = await writeFile([0x00, 0x00, 0x00, 0x00]);
    await expect(assertFileContentMatchesMimeType(filePath, "image/png")).rejects.toThrow();
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("accepts a real PNG signature claiming to be image/png", async () => {
    const filePath = await writeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(assertFileContentMatchesMimeType(filePath, "image/png")).resolves.toBeUndefined();
  });

  it("has no signature to check for a mimetype outside the allow-list, so it no-ops", async () => {
    const filePath = await writeFile([0x00, 0x01, 0x02]);
    await expect(assertFileContentMatchesMimeType(filePath, "application/octet-stream")).resolves.toBeUndefined();
  });
});
