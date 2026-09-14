import type { ApiEnvelope, ApiErrorEnvelope, ApiErrorShape, PagedEnvelope } from "./types";

const configuredBase = import.meta.env?.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBase || "http://localhost:8080").replace(/\/$/, "");
const mutating = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiClientError extends Error implements ApiErrorShape {
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly status?: number;
  constructor(error: ApiErrorShape) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.fields = error.fields;
    this.status = error.status;
  }
}

function cookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

let csrfRequest: Promise<void> | null = null;
async function ensureCsrf(signal?: AbortSignal) {
  csrfRequest ??= fetch(`${API_BASE_URL}/api/auth/csrf`, {
    credentials: "include", signal, headers: { Accept: "application/json" },
  }).then((response) => {
    if (!response.ok) throw new ApiClientError({ code: "NETWORK_ERROR", message: "Unable to initialize request security.", status: response.status });
  }).finally(() => { csrfRequest = null; });
  await csrfRequest;
}

async function errorFrom(response: Response): Promise<ApiClientError> {
  let parsed: ApiErrorEnvelope | null = null;
  try { parsed = await response.json() as ApiErrorEnvelope; } catch { /* use fallback */ }
  const error = parsed?.error;
  return new ApiClientError({
    code: error?.code ?? (response.status === 401 ? "AUTH_REQUIRED" : "HTTP_ERROR"),
    message: error?.message ?? `The server returned HTTP ${response.status}.`,
    fields: error?.fields,
    status: response.status,
  });
}

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; rawBody?: BodyInit }

export async function apiResponse(path: string, options: RequestOptions = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  if (mutating.has(method)) await ensureCsrf(options.signal ?? undefined);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (mutating.has(method)) {
    const token = cookie("XSRF-TOKEN");
    if (token) headers.set("X-XSRF-TOKEN", token);
  }
  let body = options.rawBody;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, method, headers, body, credentials: "include" });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiClientError({ code: "NETWORK_ERROR", message: "LedgerFlow could not reach the backend." });
  }
  if (!response.ok) {
    const error = await errorFrom(response);
    if (error.status === 401 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ledgerflow:auth-required"));
    throw error;
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiResponse(path, options);
  const value = await response.json() as ApiEnvelope<T>;
  return value.data;
}

export async function apiPaged<T>(path: string, options: RequestOptions = {}): Promise<PagedEnvelope<T>> {
  const response = await apiResponse(path, options);
  return await response.json() as PagedEnvelope<T>;
}

export function queryString(values: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}
