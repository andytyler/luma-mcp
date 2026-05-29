import type {
  AuthRequest,
  ClientInfo,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import {
  buildAuthorizationProps,
  clearCsrfCookie,
  createCsrfCookie,
  escapeHtml,
  LUMA_OAUTH_SCOPES,
  readCsrfCookie,
  renderAuthorizePage,
} from "./auth";
import { validateLumaApiKey, type Fetcher } from "./luma-api";

const AUTH_REQUEST_TTL_SECONDS = 600;
const AUTH_REQUEST_PREFIX = "oauth-request:";

type AuthKv = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

export type AuthEnv = {
  OAUTH_PROVIDER: Pick<
    OAuthHelpers,
    "parseAuthRequest" | "lookupClient" | "completeAuthorization"
  >;
  OAUTH_KV: AuthKv;
};

export async function handleAuthorize(
  request: Request,
  env: AuthEnv,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  if (request.method === "GET") {
    return handleAuthorizeGet(request, env);
  }

  if (request.method === "POST") {
    return handleAuthorizePost(request, env, fetcher);
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, POST" },
  });
}

async function handleAuthorizeGet(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  const oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const clientInfo = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);

  if (!clientInfo) {
    return htmlResponse(errorPage("Unknown OAuth client"), 400);
  }

  const csrfToken = crypto.randomUUID();
  await env.OAUTH_KV.put(stateKey(csrfToken), JSON.stringify(oauthRequest), {
    expirationTtl: AUTH_REQUEST_TTL_SECONDS,
  });

  return htmlResponse(
    renderAuthorizePage({
      csrfToken,
      clientName: getClientName(clientInfo, oauthRequest),
      logoUri: clientInfo.logoUri,
      scopes: oauthRequest.scope.length > 0 ? oauthRequest.scope : [...LUMA_OAUTH_SCOPES],
    }),
    200,
    createCsrfCookie(csrfToken, AUTH_REQUEST_TTL_SECONDS),
  );
}

async function handleAuthorizePost(
  request: Request,
  env: AuthEnv,
  fetcher: Fetcher,
): Promise<Response> {
  const formData = await request.formData();
  const formCsrfToken = stringFormValue(formData.get("csrf_token"));
  const cookieCsrfToken = readCsrfCookie(request);

  if (!formCsrfToken || !cookieCsrfToken || formCsrfToken !== cookieCsrfToken) {
    return htmlResponse(errorPage("Authorization expired. Start the connection again."), 400);
  }

  const storedRequest = await env.OAUTH_KV.get(stateKey(formCsrfToken));
  if (!storedRequest) {
    return htmlResponse(errorPage("Authorization expired. Start the connection again."), 400);
  }

  const lumaApiKey = stringFormValue(formData.get("luma_api_key")).trim();
  if (!lumaApiKey) {
    return htmlResponse(errorPage("Missing Luma API key."), 400);
  }

  const validation = await validateLumaApiKey(lumaApiKey, fetcher);
  if (!validation.ok) {
    return htmlResponse(
      errorPage(`Luma rejected that API key. ${validation.message}`),
      401,
      clearCsrfCookie(),
    );
  }

  await env.OAUTH_KV.delete(stateKey(formCsrfToken));
  const oauthRequest = JSON.parse(storedRequest) as AuthRequest;
  const authorization = await buildAuthorizationProps(lumaApiKey, oauthRequest.scope);
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthRequest,
    userId: authorization.userId,
    metadata: authorization.metadata,
    scope: authorization.scope,
    props: authorization.props,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: redirectTo,
      "set-cookie": clearCsrfCookie(),
    },
  });
}

function stateKey(csrfToken: string): string {
  return `${AUTH_REQUEST_PREFIX}${csrfToken}`;
}

function getClientName(clientInfo: ClientInfo, oauthRequest: AuthRequest): string {
  return clientInfo.clientName || oauthRequest.clientId;
}

function stringFormValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function htmlResponse(html: string, status = 200, setCookie?: string): Response {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src https:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; "),
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });

  if (setCookie) {
    headers.set("set-cookie", setCookie);
  }

  return new Response(html, { status, headers });
}

function errorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Luma MCP Authorization</title>
  </head>
  <body>
    <main>
      <h1>Authorization failed</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}
