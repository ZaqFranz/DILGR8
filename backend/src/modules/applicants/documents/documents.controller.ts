import type { Request, Response } from "express";
import { ValidationError } from "@/shared/errors/AppError";
import type { DocumentsService } from "./documents.service";
import { uploadDocumentFieldsSchema } from "./documents.dto";

export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  upload = async (req: Request, res: Response): Promise<void> => {
    const parsed = uploadDocumentFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid document fields", parsed.error.flatten());
    }
    const document = await this.documentsService.upload(req.user!.id, parsed.data, req.file);
    res.status(201).json(document);
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const documents = await this.documentsService.listMine(req.user!.id);
    res.status(200).json(documents);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.documentsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
