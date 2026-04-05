import { getAdminKey, getApiBaseUrl } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const base = getApiBaseUrl();
  const key = getAdminKey();
  if (!key) {
    throw new ApiError("Not signed in", 401);
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const hasBody = init?.body != null && init.body !== "";
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "X-Admin-Key": key,
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, data);
  }
  return data as T;
}
