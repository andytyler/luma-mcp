export const LUMA_OAUTH_SCOPES = ["luma.events.read", "luma.events.write"] as const;

export type LumaScopeParseMode = "default-all" | "optional";
export type LumaScopeParseResult =
  | { ok: true; value: string[] }
  | { ok: false; message: string };

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
  scriptNonce?: string;
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
  const submitScript = options.scriptNonce
    ? `<script nonce="${escapeHtml(options.scriptNonce)}">
      (() => {
        const form = document.querySelector('[data-authorize-form="true"]');
        if (!form) return;

        form.addEventListener("submit", (event) => {
          if (form.dataset.submitted === "true") {
            event.preventDefault();
            return;
          }

          form.dataset.submitted = "true";
          const button = form.querySelector('button[type="submit"]');
          if (button instanceof HTMLButtonElement) {
            button.disabled = true;
            button.textContent = "Authorizing...";
          }
        });
      })();
    </script>`
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
      <p>Paste a Luma calendar or organization API key. It will be stored only inside encrypted OAuth token props for this MCP grant.</p>
      <ul>${scopes}</ul>
      <form method="post" action="/authorize" data-authorize-form="true">
        <input type="hidden" name="csrf_token" value="${escapeHtml(options.csrfToken)}" />
        <label>
          Luma API key
          <input name="luma_api_key" type="password" autocomplete="off" required autofocus />
        </label>
        <button type="submit">Authorize</button>
      </form>
      <p class="hint">Use a key for the calendar or organization this MCP server should manage.</p>
    </main>
    ${submitScript}
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

export function parseLumaScopes(
  scopeText: string,
  mode: LumaScopeParseMode,
): LumaScopeParseResult {
  if (!scopeText.trim()) {
    return {
      ok: true,
      value: mode === "default-all" ? [...LUMA_OAUTH_SCOPES] : [],
    };
  }

  const requestedScopes = [
    ...new Set(
      scopeText
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
  const allowed = new Set<string>(LUMA_OAUTH_SCOPES);
  const unsupportedScopes = requestedScopes.filter((scope) => !allowed.has(scope));
  if (unsupportedScopes.length > 0) {
    return {
      ok: false,
      message: `Unsupported OAuth scope(s): ${unsupportedScopes.join(", ")}`,
    };
  }

  return { ok: true, value: requestedScopes };
}

function normalizeScopes(requestedScopes: string[]): string[] {
  const allowed = new Set<string>(LUMA_OAUTH_SCOPES);
  const requestedAllowed = requestedScopes
    .map((scope) => scope.trim())
    .filter((scope) => scope && allowed.has(scope));
  return [...new Set(requestedAllowed)];
}
