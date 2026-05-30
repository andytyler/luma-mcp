import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { OAuthClientMetadataSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  buildAuthorizationProps,
  escapeHtml,
  LUMA_OAUTH_SCOPES,
  parseLumaScopes,
  renderAuthorizePage,
  type AuthorizationProps,
} from "./auth";
import { validateLumaApiKey, type Fetcher } from "./luma-api";

const ACCESS_TOKEN_TTL_SECONDS = 3600;
const AUTH_CODE_TTL_SECONDS = 600;
const CSRF_TTL_SECONDS = 600;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const CLIENT_SECRET_TTL_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_BYTES = 32;

type RegisteredClient = {
  client_id: string;
  client_secret?: string;
  client_secret_hash?: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: unknown;
  software_id?: string;
  software_version?: string;
  software_statement?: string;
};

type AuthorizationParams = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string[];
  state?: string;
  resource?: string;
};

type AuthorizationParamsResult =
  | { ok: true; value: AuthorizationParams }
  | { ok: false; error: "invalid_request" | "invalid_scope"; message: string };

type StoredAuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string[];
  resource?: string;
  propsCipher: string;
  expiresAt: number;
};

type StoredToken = {
  clientId: string;
  scope: string[];
  resource?: string;
  propsCipher: string;
  expiresAt: number;
};

type TokenGrant = Omit<StoredToken, "expiresAt">;

type CsrfState = AuthorizationParams & {
  expiresAt: number;
};

type FormFields = {
  get(name: string): unknown;
};

export type RailwayOAuthOptions = {
  storagePath: string;
  appSecret: string;
  fetcher?: Fetcher;
};

export class RailwayOAuthServer {
  private readonly db: Database;
  private readonly encryptionSecret: string;
  private readonly fetcher: Fetcher;

  constructor(options: RailwayOAuthOptions) {
    if (options.appSecret.length < 32) {
      throw new Error("APP_SECRET must be at least 32 characters.");
    }

    mkdirSync(dirname(options.storagePath), { recursive: true });
    this.db = new Database(options.storagePath, { create: true, strict: true });
    this.encryptionSecret = options.appSecret;
    this.fetcher = options.fetcher ?? fetch;
    this.migrate();
  }

  health(): { ok: true; storage: string } {
    this.db.query("select 1 as ok").get();
    return { ok: true, storage: "sqlite" };
  }

  purgeExpired(now = epochSeconds()): void {
    this.db.run("delete from oauth_csrf_states where expires_at < ?", [now]);
    this.db.run("delete from oauth_authorization_codes where expires_at < ?", [now]);
    this.db.run("delete from oauth_access_tokens where expires_at < ?", [now]);
    this.db.run("delete from oauth_refresh_tokens where expires_at < ?", [now]);
    this.db.run(
      "delete from oauth_clients where client_secret_expires_at is not null and client_secret_expires_at != 0 and client_secret_expires_at < ?",
      [now],
    );
  }

  metadata(baseUrl: URL): Record<string, unknown> {
    return {
      issuer: baseUrl.origin,
      authorization_endpoint: new URL("/authorize", baseUrl).href,
      token_endpoint: new URL("/oauth/token", baseUrl).href,
      registration_endpoint: new URL("/oauth/register", baseUrl).href,
      revocation_endpoint: new URL("/oauth/revoke", baseUrl).href,
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      scopes_supported: [...LUMA_OAUTH_SCOPES],
    };
  }

  protectedResourceMetadata(baseUrl: URL): Record<string, unknown> {
    return {
      resource: new URL("/mcp", baseUrl).href,
      authorization_servers: [baseUrl.origin],
      scopes_supported: [...LUMA_OAUTH_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Luma MCP",
    };
  }

  async registerClient(request: Request): Promise<Response> {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return oauthJsonError("invalid_client_metadata", "Expected a JSON request body.", 400);
    }

    const parsed = OAuthClientMetadataSchema.safeParse(payload);
    if (!parsed.success) {
      return oauthJsonError("invalid_client_metadata", parsed.error.message, 400);
    }

    const metadata = parsed.data;
    const authMethod = metadata.token_endpoint_auth_method ?? "client_secret_post";
    if (!["none", "client_secret_post"].includes(authMethod)) {
      return oauthJsonError(
        "invalid_client_metadata",
        "Only token_endpoint_auth_method values 'none' and 'client_secret_post' are supported.",
        400,
      );
    }

    const issuedAt = epochSeconds();
    const client: RegisteredClient = {
      ...metadata,
      token_endpoint_auth_method: authMethod,
      client_id: crypto.randomUUID(),
      client_id_issued_at: issuedAt,
    };

    if (authMethod !== "none") {
      client.client_secret = randomToken();
      client.client_secret_expires_at = issuedAt + CLIENT_SECRET_TTL_SECONDS;
    }

    const clientSecretHash = client.client_secret
      ? await hashSecret(client.client_secret)
      : null;
    const storedClient: RegisteredClient = { ...client, client_secret: undefined };
    this.db.run(
      "insert into oauth_clients (client_id, client_json, client_secret_hash, client_secret_expires_at, created_at) values (?, ?, ?, ?, ?)",
      [
        client.client_id,
        JSON.stringify(storedClient),
        clientSecretHash,
        client.client_secret_expires_at ?? null,
        issuedAt,
      ],
    );

    return jsonResponse(client, 201);
  }

  async authorize(request: Request, baseUrl: URL): Promise<Response> {
    if (request.method === "POST") {
      return this.completeAuthorizeForm(request, baseUrl);
    }

    const params = parseAuthorizationParams(new URL(request.url).searchParams);
    if (!params.ok) {
      return oauthJsonError(params.error, params.message, 400);
    }

    const client = this.getClient(params.value.clientId);
    if (!client) {
      return oauthJsonError("invalid_client", "Unknown OAuth client.", 400);
    }

    if (!client.redirect_uris.includes(params.value.redirectUri)) {
      return oauthJsonError("invalid_request", "Unregistered redirect_uri.", 400);
    }

    if (params.value.responseType !== "code") {
      return redirectOAuthError(params.value.redirectUri, "unsupported_response_type", params.value.state);
    }

    if (params.value.codeChallengeMethod !== "S256" || !params.value.codeChallenge) {
      return redirectOAuthError(
        params.value.redirectUri,
        "invalid_request",
        params.value.state,
        "PKCE with S256 is required.",
      );
    }

    return this.renderAuthorizeForm(client, params.value, baseUrl);
  }

  async token(request: Request): Promise<Response> {
    const form = await request.formData();
    const grantType = stringFormValue(form.get("grant_type"));
    const client = await this.authenticateClient(request, form);
    if (!client.ok) {
      return oauthJsonError("invalid_client", client.message, 401);
    }

    if (grantType === "authorization_code") {
      return this.exchangeAuthorizationCode(client.value, form);
    }

    if (grantType === "refresh_token") {
      return this.exchangeRefreshToken(client.value, form);
    }

    return oauthJsonError("unsupported_grant_type", "Unsupported grant_type.", 400);
  }

  async revoke(request: Request): Promise<Response> {
    const form = await request.formData();
    const client = await this.authenticateClient(request, form);
    if (!client.ok) {
      return oauthJsonError("invalid_client", client.message, 401);
    }

    const token = stringFormValue(form.get("token"));
    if (!token) {
      return oauthJsonError("invalid_request", "Missing token.", 400);
    }

    const tokenHash = await hashSecret(token);
    this.db.run("delete from oauth_access_tokens where token_hash = ?", [tokenHash]);
    this.db.run("delete from oauth_refresh_tokens where token_hash = ?", [tokenHash]);
    return new Response(null, { status: 200 });
  }

  async verifyAccessToken(token: string, expectedResource?: URL): Promise<AuthInfo> {
    const row = this.getTokenRow("oauth_access_tokens", await hashSecret(token));
    if (!row || row.expiresAt < epochSeconds()) {
      throw new Error("Invalid or expired access token.");
    }

    const resource = row.resource ? new URL(row.resource) : undefined;
    if (expectedResource && resource && resource.href !== expectedResource.href) {
      throw new Error("Access token was issued for a different OAuth resource.");
    }

    return {
      token,
      clientId: row.clientId,
      scopes: row.scope,
      expiresAt: row.expiresAt,
      resource,
      extra: await this.decryptProps(row.propsCipher),
    };
  }

  private migrate(): void {
    this.db.run("pragma journal_mode = WAL");
    this.db.run("pragma foreign_keys = ON");
    this.db.run(`
      create table if not exists oauth_clients (
        client_id text primary key,
        client_json text not null,
        client_secret_hash text,
        client_secret_expires_at integer,
        created_at integer not null
      )
    `);
    this.db.run(`
      create table if not exists oauth_csrf_states (
        csrf_hash text primary key,
        state_json text not null,
        expires_at integer not null
      )
    `);
    this.db.run(`
      create table if not exists oauth_authorization_codes (
        code text primary key,
        client_id text not null,
        redirect_uri text not null,
        code_challenge text not null,
        scope_json text not null,
        resource text,
        props_cipher text not null,
        expires_at integer not null
      )
    `);
    this.db.run(`
      create table if not exists oauth_access_tokens (
        token_hash text primary key,
        client_id text not null,
        scope_json text not null,
        resource text,
        props_cipher text not null,
        expires_at integer not null
      )
    `);
    this.db.run(`
      create table if not exists oauth_refresh_tokens (
        token_hash text primary key,
        client_id text not null,
        scope_json text not null,
        resource text,
        props_cipher text not null,
        expires_at integer not null
      )
    `);
    this.db.run("create index if not exists oauth_access_tokens_expires_at on oauth_access_tokens(expires_at)");
    this.db.run("create index if not exists oauth_refresh_tokens_expires_at on oauth_refresh_tokens(expires_at)");
  }

  private getClient(clientId: string): RegisteredClient | undefined {
    const row = this.db
      .query<{ client_json: string; client_secret_hash: string | null }, [string]>(
        "select client_json, client_secret_hash from oauth_clients where client_id = ?",
      )
      .get(clientId);

    if (!row) {
      return undefined;
    }

    return {
      ...(JSON.parse(row.client_json) as RegisteredClient),
      client_secret_hash: row.client_secret_hash ?? undefined,
    };
  }

  private async renderAuthorizeForm(
    client: RegisteredClient,
    params: AuthorizationParams,
    baseUrl: URL,
  ): Promise<Response> {
    const csrfToken = crypto.randomUUID();
    const scriptNonce = base64Url(crypto.getRandomValues(new Uint8Array(16)));
    const csrfState: CsrfState = {
      ...params,
      expiresAt: epochSeconds() + CSRF_TTL_SECONDS,
    };

    this.db.run(
      "insert into oauth_csrf_states (csrf_hash, state_json, expires_at) values (?, ?, ?)",
      [await hashSecret(csrfToken), JSON.stringify(csrfState), csrfState.expiresAt],
    );

    const body = renderAuthorizePage({
      csrfToken,
      clientName: client.client_name ?? client.client_id,
      logoUri: client.logo_uri,
      scriptNonce,
      scopes: params.scope.length > 0 ? params.scope : [...LUMA_OAUTH_SCOPES],
    });

    return htmlResponse(body, 200, {
      formActionOrigin: isLoopbackHost(baseUrl.hostname) ? undefined : baseUrl.origin,
      scriptNonce,
    });
  }

  private async completeAuthorizeForm(
    request: Request,
    baseUrl: URL,
  ): Promise<Response> {
    const form = await request.clone().formData();
    const csrfToken = stringFormValue(form.get("csrf_token"));
    const csrfHash = csrfToken ? await hashSecret(csrfToken) : "";
    const csrfState = csrfHash ? this.getCsrfState(csrfHash) : undefined;

    if (!csrfToken || !csrfState || csrfState.expiresAt < epochSeconds()) {
      return htmlResponse(errorPage("Authorization expired. Start the connection again."), 400);
    }

    const params: AuthorizationParams = csrfState;
    const client = this.getClient(params.clientId);
    if (!client || !client.redirect_uris.includes(params.redirectUri)) {
      return htmlResponse(errorPage("Authorization expired. Start the connection again."), 400);
    }

    const lumaApiKey = stringFormValue(form.get("luma_api_key")).trim();
    if (!lumaApiKey) {
      return htmlResponse(errorPage("Missing Luma API key."), 400);
    }

    const validation = await validateLumaApiKey(lumaApiKey, this.fetcher);
    if (!validation.ok) {
      return htmlResponse(
        errorPage(`Luma rejected that API key. ${validation.message}`),
        401,
      );
    }

    const authorization = await buildAuthorizationProps(lumaApiKey, params.scope);
    const code = randomToken();
    await this.storeAuthorizationCode({
      code,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scope: authorization.scope,
      resource: params.resource ?? new URL("/mcp", baseUrl).href,
      propsCipher: await this.encryptProps(authorization),
      expiresAt: epochSeconds() + AUTH_CODE_TTL_SECONDS,
    });
    this.db.run("delete from oauth_csrf_states where csrf_hash = ?", [csrfHash]);

    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    if (params.state) {
      target.searchParams.set("state", params.state);
    }

    return new Response(null, {
      status: 302,
      headers: {
        location: target.href,
      },
    });
  }

  private getCsrfState(csrfHash: string): CsrfState | undefined {
    const row = this.db
      .query<{ state_json: string }, [string]>(
        "select state_json from oauth_csrf_states where csrf_hash = ?",
      )
      .get(csrfHash);
    return row ? (JSON.parse(row.state_json) as CsrfState) : undefined;
  }

  private async storeAuthorizationCode(code: StoredAuthorizationCode): Promise<void> {
    this.db.run(
      "insert into oauth_authorization_codes (code, client_id, redirect_uri, code_challenge, scope_json, resource, props_cipher, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        code.code,
        code.clientId,
        code.redirectUri,
        code.codeChallenge,
        JSON.stringify(code.scope),
        code.resource ?? null,
        code.propsCipher,
        code.expiresAt,
      ],
    );
  }

  private async authenticateClient(
    request: Request,
    form: FormFields,
  ): Promise<{ ok: true; value: RegisteredClient } | { ok: false; message: string }> {
    const basicClient = parseBasicAuth(request.headers.get("authorization"));
    const clientId = basicClient?.clientId ?? stringFormValue(form.get("client_id"));
    const clientSecret = basicClient?.clientSecret ?? stringFormValue(form.get("client_secret"));

    if (!clientId) {
      return { ok: false, message: "Missing client_id." };
    }

    const client = this.getClient(clientId);
    if (!client) {
      return { ok: false, message: "Unknown client_id." };
    }

    const authMethod = client.token_endpoint_auth_method ?? "client_secret_post";
    if (authMethod === "none") {
      return { ok: true, value: client };
    }

    if (!clientSecret || !client.client_secret_hash) {
      return { ok: false, message: "Missing client_secret." };
    }

    if (
      client.client_secret_expires_at &&
      client.client_secret_expires_at !== 0 &&
      client.client_secret_expires_at < epochSeconds()
    ) {
      return { ok: false, message: "Expired client_secret." };
    }

    const secretMatches = await constantTimeEqual(
      await hashSecret(clientSecret),
      client.client_secret_hash,
    );
    return secretMatches
      ? { ok: true, value: client }
      : { ok: false, message: "Invalid client_secret." };
  }

  private async exchangeAuthorizationCode(
    client: RegisteredClient,
    form: FormFields,
  ): Promise<Response> {
    const code = stringFormValue(form.get("code"));
    const codeVerifier = stringFormValue(form.get("code_verifier"));
    const redirectUri = stringFormValue(form.get("redirect_uri"));
    const requestedResource = stringFormValue(form.get("resource"));
    const stored = this.consumeAuthorizationCode(code);

    if (!stored || stored.expiresAt < epochSeconds()) {
      return oauthJsonError("invalid_grant", "Invalid or expired authorization code.", 400);
    }

    if (stored.clientId !== client.client_id) {
      return oauthJsonError("invalid_grant", "Authorization code was issued to another client.", 400);
    }

    if (redirectUri && redirectUri !== stored.redirectUri) {
      return oauthJsonError("invalid_grant", "redirect_uri does not match the authorization request.", 400);
    }

    if (requestedResource && stored.resource && requestedResource !== stored.resource) {
      return oauthJsonError("invalid_target", "resource does not match the authorization request.", 400);
    }

    if (!codeVerifier || !(await verifyPkceS256(codeVerifier, stored.codeChallenge))) {
      return oauthJsonError("invalid_grant", "code_verifier does not match the challenge.", 400);
    }

    const tokenGrant: TokenGrant = {
      clientId: client.client_id,
      scope: stored.scope,
      resource: stored.resource,
      propsCipher: stored.propsCipher,
    };
    const accessToken = await this.issueAccessToken(tokenGrant);
    const refreshToken = randomToken();
    await this.storeToken("oauth_refresh_tokens", refreshToken, {
      ...tokenGrant,
      expiresAt: epochSeconds() + REFRESH_TOKEN_TTL_SECONDS,
    });

    return tokenResponse(accessToken, refreshToken, stored.scope);
  }

  private async exchangeRefreshToken(
    client: RegisteredClient,
    form: FormFields,
  ): Promise<Response> {
    const refreshToken = stringFormValue(form.get("refresh_token"));
    const requestedScope = parseLumaScopes(stringFormValue(form.get("scope")), "optional");
    if (!requestedScope.ok) {
      return oauthJsonError("invalid_scope", requestedScope.message, 400);
    }
    const requestedResource = stringFormValue(form.get("resource"));
    const stored = this.getTokenRow("oauth_refresh_tokens", await hashSecret(refreshToken));

    if (!stored || stored.expiresAt < epochSeconds()) {
      return oauthJsonError("invalid_grant", "Invalid or expired refresh token.", 400);
    }

    if (stored.clientId !== client.client_id) {
      return oauthJsonError("invalid_grant", "Refresh token was issued to another client.", 400);
    }

    if (requestedResource && stored.resource && requestedResource !== stored.resource) {
      return oauthJsonError("invalid_target", "resource does not match the refresh token.", 400);
    }

    const unauthorizedScopes = requestedScope.value.filter((scope) =>
      !stored.scope.includes(scope),
    );
    if (unauthorizedScopes.length > 0) {
      return oauthJsonError(
        "invalid_scope",
        `Refresh token was not granted OAuth scope(s): ${unauthorizedScopes.join(", ")}`,
        400,
      );
    }

    const scope = requestedScope.value.length > 0 ? requestedScope.value : stored.scope;
    const accessToken = await this.issueAccessToken({
      clientId: client.client_id,
      scope,
      resource: stored.resource,
      propsCipher: stored.propsCipher,
    });

    return tokenResponse(accessToken, refreshToken, scope);
  }

  private getAuthorizationCode(code: string): StoredAuthorizationCode | undefined {
    const row = this.db
      .query<
        {
          code: string;
          client_id: string;
          redirect_uri: string;
          code_challenge: string;
          scope_json: string;
          resource: string | null;
          props_cipher: string;
          expires_at: number;
        },
        [string]
      >(
        "select code, client_id, redirect_uri, code_challenge, scope_json, resource, props_cipher, expires_at from oauth_authorization_codes where code = ?",
      )
      .get(code);

    return row
      ? {
          code: row.code,
          clientId: row.client_id,
          redirectUri: row.redirect_uri,
          codeChallenge: row.code_challenge,
          scope: JSON.parse(row.scope_json) as string[],
          resource: row.resource ?? undefined,
          propsCipher: row.props_cipher,
          expiresAt: row.expires_at,
        }
      : undefined;
  }

  private consumeAuthorizationCode(code: string): StoredAuthorizationCode | undefined {
    this.db.run("begin immediate");
    try {
      const stored = this.getAuthorizationCode(code);
      if (stored) {
        this.db.run("delete from oauth_authorization_codes where code = ?", [code]);
      }
      this.db.run("commit");
      return stored;
    } catch (error) {
      this.db.run("rollback");
      throw error;
    }
  }

  private async issueAccessToken(grant: TokenGrant): Promise<string> {
    const accessToken = randomToken();
    await this.storeToken("oauth_access_tokens", accessToken, {
      ...grant,
      expiresAt: epochSeconds() + ACCESS_TOKEN_TTL_SECONDS,
    });
    return accessToken;
  }

  private async storeToken(
    tableName: "oauth_access_tokens" | "oauth_refresh_tokens",
    token: string,
    stored: StoredToken,
  ): Promise<void> {
    this.db.run(
      `insert into ${tableName} (token_hash, client_id, scope_json, resource, props_cipher, expires_at) values (?, ?, ?, ?, ?, ?)`,
      [
        await hashSecret(token),
        stored.clientId,
        JSON.stringify(stored.scope),
        stored.resource ?? null,
        stored.propsCipher,
        stored.expiresAt,
      ],
    );
  }

  private getTokenRow(
    tableName: "oauth_access_tokens" | "oauth_refresh_tokens",
    tokenHash: string,
  ): StoredToken | undefined {
    const row = this.db
      .query<
        {
          client_id: string;
          scope_json: string;
          resource: string | null;
          props_cipher: string;
          expires_at: number;
        },
        [string]
      >(
        `select client_id, scope_json, resource, props_cipher, expires_at from ${tableName} where token_hash = ?`,
      )
      .get(tokenHash);

    return row
      ? {
          clientId: row.client_id,
          scope: JSON.parse(row.scope_json) as string[],
          resource: row.resource ?? undefined,
          propsCipher: row.props_cipher,
          expiresAt: row.expires_at,
        }
      : undefined;
  }

  private async encryptProps(authorization: AuthorizationProps): Promise<string> {
    const key = await encryptionKey(this.encryptionSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(authorization.props));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return `v1:${base64Url(iv)}:${base64Url(new Uint8Array(ciphertext))}`;
  }

  private async decryptProps(ciphertext: string): Promise<Record<string, unknown>> {
    const [version, ivPart, cipherPart] = ciphertext.split(":");
    if (version !== "v1" || !ivPart || !cipherPart) {
      throw new Error("Unsupported encrypted OAuth props format.");
    }

    const key = await encryptionKey(this.encryptionSecret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(cipherPart),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
  }
}

export function jsonResponse(
  value: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");

  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

export function oauthJsonError(error: string, description: string, status: number): Response {
  return jsonResponse(
    {
      error,
      error_description: description,
    },
    status,
  );
}

function tokenResponse(accessToken: string, refreshToken: string, scope: string[]): Response {
  return jsonResponse({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scope.join(" "),
  });
}

export function bearerError(baseUrl: URL, description = "Missing or invalid access token."): Response {
  return jsonResponse(
    {
      error: "invalid_token",
      error_description: description,
    },
    401,
    {
      "www-authenticate": `Bearer error="invalid_token", error_description="${headerEscape(
        description,
      )}", resource_metadata="${new URL("/.well-known/oauth-protected-resource/mcp", baseUrl).href}"`,
    },
  );
}

function htmlResponse(
  html: string,
  status = 200,
  options: { formActionOrigin?: string; scriptNonce?: string } = {},
): Response {
  const contentSecurityPolicy = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];
  if (options.formActionOrigin) {
    contentSecurityPolicy.push(
      ["form-action", "'self'", options.formActionOrigin].filter(Boolean).join(" "),
    );
  }
  if (options.scriptNonce) {
    contentSecurityPolicy.push(`script-src 'nonce-${options.scriptNonce}'`);
  }

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": contentSecurityPolicy.join("; "),
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });

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

function parseAuthorizationParams(values: URLSearchParams): AuthorizationParamsResult {
  const clientId = stringFormValue(values.get("client_id"));
  const redirectUri = stringFormValue(values.get("redirect_uri"));
  const responseType = stringFormValue(values.get("response_type"));
  const codeChallenge = stringFormValue(values.get("code_challenge"));
  const codeChallengeMethod = stringFormValue(values.get("code_challenge_method"));
  const scope = parseLumaScopes(stringFormValue(values.get("scope")), "default-all");
  const state = stringFormValue(values.get("state")) || undefined;
  const resource = stringFormValue(values.get("resource")) || undefined;

  if (!scope.ok) {
    return { ok: false, error: "invalid_scope", message: scope.message };
  }

  if (!clientId || !redirectUri || !responseType || !codeChallenge || !codeChallengeMethod) {
    return {
      ok: false,
      error: "invalid_request",
      message:
        "client_id, redirect_uri, response_type, code_challenge, and code_challenge_method are required.",
    };
  }

  if (!canParseUrl(redirectUri)) {
    return { ok: false, error: "invalid_request", message: "redirect_uri must be a valid URL." };
  }

  if (resource && !canParseUrl(resource)) {
    return { ok: false, error: "invalid_request", message: "resource must be a valid URL." };
  }

  return {
    ok: true,
    value: {
      clientId,
      redirectUri,
      responseType,
      codeChallenge,
      codeChallengeMethod,
      scope: scope.value,
      state,
      resource,
    },
  };
}

function redirectOAuthError(
  redirectUri: string,
  error: string,
  state?: string,
  description?: string,
): Response {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  if (description) {
    target.searchParams.set("error_description", description);
  }
  if (state) {
    target.searchParams.set("state", state);
  }
  return Response.redirect(target.href, 302);
}

function stringFormValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseBasicAuth(header: string | null): { clientId: string; clientSecret: string } | undefined {
  if (!header?.startsWith("Basic ")) {
    return undefined;
  }

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      return undefined;
    }
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return undefined;
  }
}

async function verifyPkceS256(verifier: string, expectedChallenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return constantTimeEqual(base64Url(new Uint8Array(digest)), expectedChallenge);
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function hashSecret(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function epochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function headerEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function canParseUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
