import fs from "node:fs/promises";
import type { PrismaClient, Document, DocumentType, Role } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicantsRepository } from "../applicants.repository";
import type { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import type { CreateDocumentInput, DocumentsRepository } from "./documents.repository";
import type { UploadDocumentFieldsDto } from "./documents.dto";

export interface DocumentViewer {
  id: string;
  role: Role;
}

/** A Document as it should ever reach a client - never `filePath` (the server's absolute on-disk path), which every caller of the endpoints below used to receive verbatim regardless of role. */
export type PublicDocument = Omit<Document, "filePath">;

export function toPublicDocument(document: Document): PublicDocument {
  const { filePath, ...rest } = document;
  void filePath;
  return rest;
}

// Interview panelists never get the applicant's full document set - only
// the PDS itself (PDF copy and/or the CS Form 212 workbook), and only for
// an applicant currently on one of their assigned interview boards. Keeps
// "panel can see the PDS while interviewing" from widening into "panel can
// browse every document an applicant has ever uploaded".
const PANEL_VISIBLE_DOCUMENT_TYPES = new Set<DocumentType>(["PDS", "PDS_EXCEL"]);

export interface UploadedFileInfo {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
}

// These represent one current document per applicant - re-uploading
// replaces whatever was there before rather than accumulating duplicates
// with no way to tell which is authoritative. LD_PROOF/AWARD_PROOF aren't
// here since their "one slot" is scoped per LdIntervention/Award entry
// instead of per applicant - handled separately below - and OTHER is a
// genuine multi-file miscellaneous catch-all, exempt entirely.
const SINGLE_INSTANCE_TYPES = new Set<DocumentType>([
  "PDS",
  "PDS_EXCEL",
  "IPCR",
  "ELIGIBILITY_PROOF",
  "TRANSCRIPT_OF_RECORDS",
  "DIPLOMA",
  "PQE_NOTICE",
  "DESIGNATION_ORDER",
]);

const PDF_OR_IMAGE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

// Every document type accepts a scanned/printed PDF (or a photo of a paper
// copy, JPEG/PNG) by default. PDS is the one exception with two distinct
// required files - the CS Form 212 workbook itself (PDS_EXCEL) alongside the
// signed printed/scanned copy (PDS) - so it needs its own stricter,
// spreadsheet-only slot rather than sharing the PDF/image default.
const ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE: Partial<Record<DocumentType, Set<string>>> = {
  PDS_EXCEL: EXCEL_MIME_TYPES,
};

function assertMimeTypeAllowed(type: DocumentType, mimetype: string): void {
  const allowed = ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE[type] ?? PDF_OR_IMAGE_MIME_TYPES;
  if (!allowed.has(mimetype)) {
    const expected = allowed === EXCEL_MIME_TYPES ? "an XLSX or XLS file" : "a PDF, JPEG, or PNG file";
    throw new ValidationError(`This document must be uploaded as ${expected}`);
  }
}

export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly panelAssignmentsRepository: PanelAssignmentsRepository,
    private readonly db: PrismaClient,
  ) {}

  async upload(userId: string, fields: UploadDocumentFieldsDto, file?: UploadedFileInfo): Promise<PublicDocument> {
    if (!file) {
      throw new ValidationError("A file is required");
    }
    assertMimeTypeAllowed(fields.type, file.mimetype);

    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    if (fields.applicationId) {
      const application = await this.db.application.findUnique({ where: { id: fields.applicationId } });
      if (!application || application.applicantId !== applicant.id) {
        throw new NotFoundError("Application");
      }
    }

    if (fields.ldInterventionId) {
      const ldIntervention = await this.db.ldIntervention.findUnique({ where: { id: fields.ldInterventionId } });
      if (!ldIntervention || ldIntervention.applicantId !== applicant.id) {
        throw new NotFoundError("L&D intervention");
      }
    }

    if (fields.awardId) {
      const award = await this.db.award.findUnique({ where: { id: fields.awardId } });
      if (!award || award.applicantId !== applicant.id) {
        throw new NotFoundError("Award");
      }
    }

    if (fields.complianceItemId) {
      const item = await this.db.applicationComplianceItem.findUnique({
        where: { id: fields.complianceItemId },
        include: { application: true },
      });
      if (!item || item.application.applicantId !== applicant.id) {
        throw new NotFoundError("Compliance item");
      }
      if (item.application.status !== "FOR_COMPLIANCE") {
        throw new ValidationError("Proof can only be uploaded while the application is in Compliance to Requirements");
      }
    }

    // One current file per "slot" - an applicant-level slot for
    // SINGLE_INSTANCE_TYPES, or a per-entry slot (this specific
    // LdIntervention/Award) for LD_PROOF/AWARD_PROOF - so re-uploading
    // always replaces rather than accumulating duplicates with no way to
    // tell which one is authoritative.
    const existingDocs = await this.documentsRepository.findByApplicant(applicant.id);
    const duplicate = SINGLE_INSTANCE_TYPES.has(fields.type)
      ? existingDocs.find((doc) => doc.type === fields.type)
      : fields.type === "LD_PROOF" && fields.ldInterventionId
        ? existingDocs.find((doc) => doc.type === "LD_PROOF" && doc.ldInterventionId === fields.ldInterventionId)
        : fields.type === "AWARD_PROOF" && fields.awardId
          ? existingDocs.find((doc) => doc.type === "AWARD_PROOF" && doc.awardId === fields.awardId)
          : fields.type === "COMPLIANCE_PROOF" && fields.complianceItemId
            ? existingDocs.find((doc) => doc.type === "COMPLIANCE_PROOF" && doc.complianceItemId === fields.complianceItemId)
            : undefined;
    if (duplicate) {
      await this.documentsRepository.delete(duplicate.id);
      await fs.unlink(duplicate.filePath).catch(() => undefined);
    }

    const input: CreateDocumentInput = {
      applicantId: applicant.id,
      type: fields.type,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      ...(fields.applicationId ? { applicationId: fields.applicationId } : {}),
      ...(fields.ldInterventionId ? { ldInterventionId: fields.ldInterventionId } : {}),
      ...(fields.awardId ? { awardId: fields.awardId } : {}),
      ...(fields.complianceItemId ? { complianceItemId: fields.complianceItemId } : {}),
    };

    const created = await this.documentsRepository.create(input);
    return toPublicDocument(created);
  }

  async listMine(userId: string): Promise<PublicDocument[]> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    const documents = await this.documentsRepository.findByApplicant(applicant.id);
    return documents.map(toPublicDocument);
  }

  /**
   * List a specific applicant's documents, for the Evaluate Applicants "View
   * Documents" modal (admin, full set) and the panel's "View PDS" action
   * (panel, PDS only - and only while that applicant is on one of the
   * panelist's assigned interview boards).
   */
  async listForApplicant(applicantId: string, viewer: DocumentViewer): Promise<PublicDocument[]> {
    const applicant = await this.applicantsRepository.findById(applicantId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    const documents = await this.documentsRepository.findByApplicant(applicantId);
    if (viewer.role === "PANEL") {
      await this.assertPanelistMayViewApplicant(viewer.id, applicantId);
      return documents.filter((doc) => PANEL_VISIBLE_DOCUMENT_TYPES.has(doc.type)).map(toPublicDocument);
    }
    return documents.map(toPublicDocument);
  }

  /**
   * Resolves a document to its file on disk for viewing/download. Checked
   * separately from the DB lookup (not just trusted from `Document.filePath`)
   * so a document whose underlying file is missing fails with a clear 404
   * instead of a raw filesystem error reaching the client.
   */
  async getFileForViewer(
    documentId: string,
    viewer: DocumentViewer,
  ): Promise<{ filePath: string; mimeType: string; fileName: string }> {
    const document = await this.documentsRepository.findById(documentId);
    if (!document) {
      throw new NotFoundError("Document");
    }
    if (viewer.role === "PANEL") {
      if (!PANEL_VISIBLE_DOCUMENT_TYPES.has(document.type)) {
        throw new ForbiddenError("Panel members may only view the applicant's PDS");
      }
      await this.assertPanelistMayViewApplicant(viewer.id, document.applicantId);
    }
    try {
      await fs.access(document.filePath);
    } catch {
      throw new NotFoundError("Document file");
    }
    return { filePath: document.filePath, mimeType: document.mimeType, fileName: document.fileName };
  }

  private async assertPanelistMayViewApplicant(panelUserId: string, applicantId: string): Promise<void> {
    const assigned = await this.panelAssignmentsRepository.isPanelUserAssignedToApplicant(panelUserId, applicantId);
    if (!assigned) {
      throw new ForbiddenError("You are not assigned to interview this applicant");
    }
  }

  async remove(userId: string, documentId: string): Promise<void> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    const document = await this.documentsRepository.findById(documentId);
    if (!document || document.applicantId !== applicant.id) {
      throw new NotFoundError("Document");
    }

    await this.documentsRepository.delete(documentId);
    await fs.unlink(document.filePath).catch(() => undefined);
  }
}
