import { ZodType } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ACCESS_TOKEN_KEY = "flowctrl.access_token";

type RequestOptions = {
  auth?: boolean;
  token?: string | null;
};

export type DownloadResult = {
  blob: Blob;
  filename: string | null;
};

export class ApiError extends Error {
  status: number;
  detail: string | null;

  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = options.token ?? getStoredAccessToken();

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function parseResponse<T>(response: Response, schema: ZodType<T>): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : null;
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, detail);
  }

  return schema.parse(data);
}

export async function apiGet<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(options),
    cache: "no-store",
  });

  return parseResponse(response, schema);
}

export async function apiPost<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  schema: ZodType<TResponse>,
  options: RequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(options),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return parseResponse(response, schema);
}

export async function apiDownload(
  path: string,
  options: RequestOptions = {},
): Promise<DownloadResult> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(options),
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail =
      data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : null;
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, detail);
  }

  const filename = response.headers
    .get("content-disposition")
    ?.match(/filename="([^"]+)"/)?.[1] ?? null;

  return {
    blob: await response.blob(),
    filename,
  };
}
