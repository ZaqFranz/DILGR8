const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  isFormData?: boolean;
}

/**
 * Thin fetch wrapper: attaches the JWT bearer token, serializes JSON
 * bodies, and unwraps the backend's `{ error: { code, message, details } }`
 * shape into a typed ApiError so callers can `catch (err) { if (err
 * instanceof ApiError) ... }` instead of re-parsing responses everywhere.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.isFormData) {
      body = options.body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const errorPayload = data?.error ?? { code: "UNKNOWN", message: "Request failed" };
    throw new ApiError(errorPayload.message, response.status, errorPayload.code, errorPayload.details);
  }

  return data as T;
}

/**
 * For endpoints that return raw file bytes (e.g. viewing an uploaded
 * document) rather than JSON - same auth header and error-unwrapping as
 * `apiRequest`, but resolves to a `Blob` instead of parsing the body as
 * JSON on success.
 */
export async function apiRequestBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, { headers });

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    const errorPayload = data?.error ?? { code: "UNKNOWN", message: "Request failed" };
    throw new ApiError(errorPayload.message, response.status, errorPayload.code, errorPayload.details);
  }

  return response.blob();
}
