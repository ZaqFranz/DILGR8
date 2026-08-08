import fs from "node:fs/promises";
import type { PrismaClient, Document } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicantsRepository } from "../applicants.repository";
import type { CreateDocumentInput, DocumentsRepository } from "./documents.repository";
import type { UploadDocumentFieldsDto } from "./documents.dto";

export interface UploadedFileInfo {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
}

export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly db: PrismaClient,
  ) {}

  async upload(userId: string, fields: UploadDocumentFieldsDto, file?: UploadedFileInfo): Promise<Document> {
    if (!file) {
      throw new ValidationError("A file is required");
    }

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

    const input: CreateDocumentInput = {
      applicantId: applicant.id,
      type: fields.type,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      ...(fields.applicationId ? { applicationId: fields.applicationId } : {}),
      ...(fields.ldInterventionId ? { ldInterventionId: fields.ldInterventionId } : {}),
    };

    return this.documentsRepository.create(input);
  }

  async listMine(userId: string): Promise<Document[]> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    return this.documentsRepository.findByApplicant(applicant.id);
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
