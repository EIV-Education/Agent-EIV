import { config } from "../config";

export interface WebhookCallInput {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export interface WebhookCallResult {
  status: number;
  body: string;
}

function assertAllowed(url: string): void {
  const allowed = config.internalApi.allowedBaseUrls;
  if (allowed.length === 0) {
    throw new Error(
      "INTERNAL_API_ALLOWED_BASE_URLS chua duoc cau hinh - agent khong duoc phep goi bat ky URL noi bo nao."
    );
  }
  const isAllowed = allowed.some((base) => url === base || url.startsWith(base.endsWith("/") ? base : `${base}/`));
  if (!isAllowed) {
    throw new Error(`URL "${url}" khong nam trong danh sach INTERNAL_API_ALLOWED_BASE_URLS cho phep.`);
  }
}

export async function callInternalApi(input: WebhookCallInput): Promise<WebhookCallResult> {
  assertAllowed(input.url);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.internalApi.token) {
    headers.Authorization = `Bearer ${config.internalApi.token}`;
  }

  const res = await fetch(input.url, {
    method: input.method ?? "GET",
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });

  const body = await res.text();
  return { status: res.status, body };
}
