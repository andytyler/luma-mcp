const LUMA_API_BASE_URL = "https://public-api.luma.com";

export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export type LumaRequestOptions = {
  apiKey: string;
  path: string;
  query?: QueryParams;
  body?: unknown;
  method?: "GET" | "POST";
};

export type LumaApiKeyType = "calendar" | "organization";
export type LumaValidationResult =
  | { ok: true; keyType: LumaApiKeyType }
  | { ok: false; status: number; message: string };

export function buildLumaUrl(path: string, query: QueryParams = {}): URL {
  const url = new URL(validateLumaPath(path), LUMA_API_BASE_URL);

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export function validateLumaPath(path: string): string {
  if (!path.startsWith("/v1/")) {
    throw new Error("Luma path must be a relative /v1/ path");
  }

  if (path.includes("://") || path.includes("..")) {
    throw new Error("Luma path cannot contain path traversal or absolute URLs");
  }

  return path;
}

export async function lumaRequest(
  options: LumaRequestOptions,
  fetcher: Fetcher = fetch,
): Promise<unknown> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers({
    accept: "application/json",
    "x-luma-api-key": options.apiKey,
  });

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetcher(buildLumaUrl(options.path, options.query), {
    method,
    headers,
    body,
  });

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const detail = data === undefined ? text : JSON.stringify(data);
    throw new Error(
      `Luma API request failed with ${response.status}: ${detail || response.statusText}`,
    );
  }

  return data ?? {};
}

export async function validateLumaApiKey(
  apiKey: string,
  fetcher: Fetcher = fetch,
): Promise<LumaValidationResult> {
  const probes: Array<{ keyType: LumaApiKeyType; path: string; query: QueryParams }> = [
    {
      keyType: "calendar",
      path: "/v1/calendar/list-events",
      query: { pagination_limit: 1 },
    },
    {
      keyType: "organization",
      path: "/v1/organizations/calendars/list",
      query: { pagination_limit: 1 },
    },
  ];
  let lastFailure: LumaValidationResult | undefined;

  for (const probe of probes) {
    const result = await validateLumaApiKeyAgainstProbe(apiKey, probe, fetcher);
    if (result.ok) {
      return result;
    }
    lastFailure = result;
  }

  return lastFailure ?? { ok: false, status: 500, message: "Unknown Luma error" };
}

async function validateLumaApiKeyAgainstProbe(
  apiKey: string,
  probe: { keyType: LumaApiKeyType; path: string; query: QueryParams },
  fetcher: Fetcher,
): Promise<LumaValidationResult> {
  try {
    await lumaRequest(
      {
        apiKey,
        path: probe.path,
        query: probe.query,
      },
      fetcher,
    );
    return { ok: true, keyType: probe.keyType };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Luma error";
    const statusMatch = message.match(/failed with (\d{3})/);
    return {
      ok: false,
      status: statusMatch ? Number(statusMatch[1]) : 500,
      message,
    };
  }
}

export function formatLumaResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function parseJson(text: string): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
