// devtunnels forwards each port under its own subdomain
// (<id>-<port>.<region>.devtunnels.ms) - when this page is loaded through
// the frontend's tunnel URL, VITE_API_URL (baked in at dev-server start,
// always pointing at one fixed backend address) would otherwise force
// every visitor through that same fixed address even when they're on
// plain localhost, making local dev depend on the tunnel staying up. Instead,
// derive the backend's tunnel URL from whatever host this page is currently
// on, so localhost keeps using VITE_API_URL/localhost regardless of what
// that env var happens to be set to for a demo.
function resolveApiUrl(): string {
  const { hostname, protocol } = window.location;
  const tunnelMatch = hostname.match(/^(.+)-5173(\.[a-z0-9.-]+\.devtunnels\.ms)$/);
  if (tunnelMatch) {
    return `${protocol}//${tunnelMatch[1]}-4000${tunnelMatch[2]}/api`;
  }
  return import.meta.env.VITE_API_URL;
}

const API_URL = resolveApiUrl();

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

/**
 * Fires when an authenticated request (one that carried a Bearer token)
 * comes back 401 - the token expired or was invalidated server-side.
 * AuthContext registers this to clear the session and redirect to /login,
 * so any page holding a stale token bounces out instead of sitting on a
 * broken screen. Never fires for unauthenticated requests (e.g. a login
 * attempt with bad credentials also returns 401) since no token was sent.
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function handleUnauthorized(hadToken: boolean): void {
  if (hadToken) {
    onSessionExpired?.();
  }
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
  const hadToken = authToken !== null;
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
    if (response.status === 401) {
      handleUnauthorized(hadToken);
    }
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
  const hadToken = authToken !== null;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, { headers });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(hadToken);
    }
    const data = await response.json().catch(() => undefined);
    const errorPayload = data?.error ?? { code: "UNKNOWN", message: "Request failed" };
    throw new ApiError(errorPayload.message, response.status, errorPayload.code, errorPayload.details);
  }

  return response.blob();
}
