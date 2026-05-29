const CSRF_COOKIE_NAME = "__Host-luma_mcp_csrf";
export const LUMA_OAUTH_SCOPES = ["luma.events.read", "luma.events.write"] as const;

export type AuthorizationProps = {
  userId: string;
  scope: string[];
  props: {
    lumaApiKey: string;
    lumaApiKeyHash: string;
    grantedAt: string;
    scopes: string[];
  };
  metadata: {
    apiKeyHash: string;
    grantedAt: string;
  };
};

export type AuthorizePageOptions = {
  csrfToken: string;
  clientName?: string;
  logoUri?: string;
  scopes?: string[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeHttpUrl(value: string | undefined): string {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function createCsrfCookie(token: string, maxAgeSeconds: number): string {
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

export function readCsrfCookie(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie") ?? "")[CSRF_COOKIE_NAME];
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      cookies[trimmed] = "";
      continue;
    }

    const key = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1);
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function renderAuthorizePage(options: AuthorizePageOptions): string {
  const clientName = escapeHtml(options.clientName || "MCP Client");
  const logoUri = sanitizeHttpUrl(options.logoUri);
  const scopes = (options.scopes?.length ? options.scopes : ["luma.events.read"])
    .map((scope) => `<li>${escapeHtml(scope)}</li>`)
    .join("");

  const logo = logoUri
    ? `<img src="${escapeHtml(logoUri)}" alt="" class="client-logo" />`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize Luma MCP</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: Canvas;
        color: CanvasText;
      }
      main {
        width: min(100% - 32px, 480px);
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        padding: 28px;
      }
      h1 {
        font-size: 1.4rem;
        margin: 0 0 12px;
      }
      p, li, label {
        line-height: 1.5;
      }
      .client {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 18px;
      }
      .client-logo {
        width: 36px;
        height: 36px;
        border-radius: 6px;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        margin-top: 8px;
        padding: 12px;
        font: inherit;
      }
      button {
        width: 100%;
        margin-top: 18px;
        padding: 12px;
        font: inherit;
        font-weight: 650;
        cursor: pointer;
      }
      .hint {
        font-size: 0.9rem;
        opacity: 0.75;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="client">${logo}<strong>${clientName}</strong></div>
      <h1>Connect Luma to your MCP client</h1>
      <p>Paste a Luma calendar API key. It will be stored only inside encrypted OAuth token props for this MCP grant.</p>
      <ul>${scopes}</ul>
      <form method="post" action="/authorize">
        <input type="hidden" name="csrf_token" value="${escapeHtml(options.csrfToken)}" />
        <label>
          Luma API key
          <input name="luma_api_key" type="password" autocomplete="off" required autofocus />
        </label>
        <button type="submit">Authorize</button>
      </form>
      <p class="hint">Luma API keys are calendar-scoped and require Luma Plus on that calendar.</p>
    </main>
  </body>
</html>`;
}

export async function buildAuthorizationProps(
  lumaApiKey: string,
  requestedScopes: string[] = [...LUMA_OAUTH_SCOPES],
): Promise<AuthorizationProps> {
  const apiKeyHash = await hashApiKey(lumaApiKey);
  const grantedAt = new Date().toISOString();
  const scope = normalizeScopes(requestedScopes);

  return {
    userId: `luma:${apiKeyHash.slice(0, 16)}`,
    scope,
    props: {
      lumaApiKey,
      lumaApiKeyHash: apiKeyHash,
      grantedAt,
      scopes: scope,
    },
    metadata: {
      apiKeyHash,
      grantedAt,
    },
  };
}

function normalizeScopes(requestedScopes: string[]): string[] {
  const allowed = new Set<string>(LUMA_OAUTH_SCOPES);
  const requestedAllowed = requestedScopes.filter((scope) => allowed.has(scope));
  return requestedAllowed.length > 0 ? requestedAllowed : [...LUMA_OAUTH_SCOPES];
}
