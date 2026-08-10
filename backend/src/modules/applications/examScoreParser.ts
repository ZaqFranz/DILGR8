import ExcelJS from "exceljs";
import { ValidationError } from "@/shared/errors/AppError";

export interface ParsedExamScoreRow {
  name: string;
  score: number;
  jobTitle?: string;
}

// Expects a header row with "Name" and "Score" columns (case-insensitive,
// any order/extra columns ignored) - matches the export shape of a typical
// PQE results spreadsheet. A "Job Title" column is optional: it's required
// when importing across all job postings at once (name alone can't
// disambiguate an applicant who's Qualified on more than one posting), but
// ignored when importing for a single selected posting. Rows with a blank
// name or non-numeric score are silently skipped rather than failing the
// whole import.
export async function parseExamScoreWorkbook(buffer: Buffer): Promise<ParsedExamScoreRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own type declarations shadow the global `Buffer` with a bogus
  // `Buffer extends ArrayBuffer` interface, which no longer matches Node's
  // real (generic) Buffer type in current @types/node - cast around their
  // broken .d.ts rather than the actual (valid) Buffer we're passing.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ValidationError("The uploaded file has no worksheet");
  }

  let nameColumn = -1;
  let scoreColumn = -1;
  let jobTitleColumn = -1;
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = String(cell.value ?? "").trim().toLowerCase();
    if (header === "name") nameColumn = colNumber;
    if (header === "score") scoreColumn = colNumber;
    if (header === "job title") jobTitleColumn = colNumber;
  });
  if (nameColumn === -1 || scoreColumn === -1) {
    throw new ValidationError('The uploaded file must have "Name" and "Score" header columns');
  }

  const rows: ParsedExamScoreRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = String(row.getCell(nameColumn).value ?? "").trim();
    const rawScore = row.getCell(scoreColumn).value;
    const score = typeof rawScore === "number" ? rawScore : Number(rawScore);
    if (!name || !Number.isFinite(score)) return;
    const jobTitle = jobTitleColumn !== -1 ? String(row.getCell(jobTitleColumn).value ?? "").trim() || undefined : undefined;
    rows.push({ name, score: Math.round(score), ...(jobTitle ? { jobTitle } : {}) });
  });

  return rows;
}
