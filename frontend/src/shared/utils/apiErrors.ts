import { ApiError } from "@/shared/api/apiClient";

interface ZodFlattenedError {
  fieldErrors?: Record<string, string[]>;
}

/**
 * Maps a Zod-validation ApiError (backend's `validate` middleware throws
 * ValidationError with `result.error.flatten()` as `details`) to a
 * field-keyed record of the first message per field, so forms can render
 * server-side validation errors inline under the right input without each
 * form hand-rolling the same rules the backend already enforces.
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const details = err.details as ZodFlattenedError | undefined;
  if (!details?.fieldErrors) return {};

  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(details.fieldErrors)) {
    if (messages && messages.length > 0) {
      result[field] = messages[0]!;
    }
  }
  return result;
}
