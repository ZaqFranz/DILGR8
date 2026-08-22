import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";
import type { PublicUser, UsersRepository } from "./users.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import type { EmailService } from "@/shared/email/emailService";

function fakePublicUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: "target-user",
    email: "applicant@example.com",
    name: null,
    role: "APPLICANT",
    createdAt: new Date(),
    updatedAt: new Date(),
    applicant: null,
    ...overrides,
  };
}

function buildService(opts: { hasApplicationHistory: boolean; targetUser?: PublicUser | null }) {
  const usersRepository = {
    findById: vi.fn().mockResolvedValue(opts.targetUser === undefined ? fakePublicUser() : opts.targetUser),
    hasApplicationHistory: vi.fn().mockResolvedValue(opts.hasApplicationHistory),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as UsersRepository;

  const auditLogsRepository = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogsRepository;
  const emailService = { send: vi.fn() } as unknown as EmailService;

  const service = new UsersService(usersRepository, auditLogsRepository, emailService);
  return { service, usersRepository, auditLogsRepository };
}

describe("UsersService.remove", () => {
  it("blocks hard-deleting a user who has job application history", async () => {
    // Reproduces audit finding F-01: User -> Applicant -> Application ->
    // (PanelEvaluation / ApplicationComplianceItem / Document /
    // ApplicantGroupMember) cascade-deletes in the schema, so an
    // unconditional delete() would silently erase real hiring history.
    const { service, usersRepository } = buildService({ hasApplicationHistory: true });

    await expect(service.remove("admin-1", "target-user")).rejects.toThrow(
      "This account has job application history and cannot be deleted",
    );
    expect(usersRepository.delete).not.toHaveBeenCalled();
  });

  it("still allows deleting a user with no application history", async () => {
    const { service, usersRepository, auditLogsRepository } = buildService({ hasApplicationHistory: false });

    await service.remove("admin-1", "target-user");

    expect(usersRepository.delete).toHaveBeenCalledWith("target-user");
    expect(auditLogsRepository.record).toHaveBeenCalledTimes(1);
  });

  it("still blocks deleting your own account before the history check even runs", async () => {
    const { service, usersRepository } = buildService({ hasApplicationHistory: false });

    await expect(service.remove("self-1", "self-1")).rejects.toThrow("You cannot delete your own account");
    expect(usersRepository.hasApplicationHistory).not.toHaveBeenCalled();
  });
});
