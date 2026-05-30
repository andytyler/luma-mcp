import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { RailwayOAuthServer } from "../src/railway-oauth";
import type { Fetcher } from "../src/luma-api";

const appSecret = "test-secret-with-at-least-thirty-two-characters";
const baseUrl = new URL("https://mcp.example.com");
const localBaseUrl = new URL("http://localhost:3000");
const redirectUri = "https://client.example.com/callback";
const verifier = "test-code-verifier-that-is-long-enough";
const defaultResource = "https://mcp.example.com/mcp";

type RegisteredClientResponse = {
  client_id: string;
};
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

describe("Railway OAuth runtime", () => {
  test("registers a public client and exchanges an authorization code for encrypted Luma props", async () => {
    const lumaValidationCalls: Request[] = [];
    const fetcher: Fetcher = async (input, init) => {
      const request = makeRequest(input, init);
      lumaValidationCalls.push(request);
      return Response.json({ entries: [] });
    };
    const oauth = new RailwayOAuthServer({
      storagePath: join(mkdtempSync(join(tmpdir(), "luma-mcp-test-")), "oauth.sqlite"),
      appSecret,
      fetcher,
    });
    const challenge = await pkceChallenge(verifier);

    const client = await registerPublicClient(oauth, {
      client_name: "Test MCP Client",
    });

    const authorizeForm = await oauth.authorize(
      new Request(
        authorizeUrl(client, {
          challenge,
          state: "state-123",
          resource: defaultResource,
        }),
      ),
      baseUrl,
    );
    const authorizeHtml = await authorizeForm.text();
    const csrfToken = extractInput(authorizeHtml, "csrf_token");

    const authorizePost = await authorizeWithLumaKey(oauth, csrfToken);

    const redirect = new URL(authorizePost.headers.get("location") ?? "");
    const code = redirect.searchParams.get("code") ?? "";
    expect(authorizePost.status).toBe(302);
    expect(redirect.searchParams.get("state")).toBe("state-123");
    expect(code).toBeTruthy();
    expect(lumaValidationCalls[0].headers.get("x-luma-api-key")).toBe("luma-valid-key");

    const tokenResponse = await exchangeCode(oauth, client, code);
    const tokenBody = (await tokenResponse.json()) as TokenResponse;
    const authInfo = await oauth.verifyAccessToken(tokenBody.access_token);

    expect(tokenResponse.status).toBe(200);
    expect(tokenBody.token_type).toBe("bearer");
    expect(tokenBody.refresh_token).toBeTruthy();
    expect(authInfo.scopes).toEqual(["luma.events.read"]);
    expect(authInfo.extra?.lumaApiKey).toBe("luma-valid-key");
    expect(typeof authInfo.extra?.lumaApiKeyHash).toBe("string");
    expect(authInfo.resource?.href).toBe("https://mcp.example.com/mcp");
  });

  test("uses the server-side authorize state instead of submitted OAuth fields", async () => {
    const oauth = makeOAuth();
    const challenge = await pkceChallenge(verifier);
    const client = await registerPublicClient(oauth);

    const authorizeForm = await oauth.authorize(
      new Request(
        authorizeUrl(client, {
          challenge,
          state: "state-123",
          resource: defaultResource,
        }),
      ),
      baseUrl,
    );
    const csrfToken = extractInput(await authorizeForm.text(), "csrf_token");

    const response = await oauth.authorize(
      new Request("https://mcp.example.com/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: client.client_id,
          redirect_uri: redirectUri,
          response_type: "code",
          code_challenge: "mutated-challenge",
          code_challenge_method: "S256",
          scope: "luma.events.write",
          state: "mutated-state",
          resource: "https://evil.example/mcp",
          csrf_token: csrfToken,
          luma_api_key: "luma-valid-key",
        }),
      }),
      baseUrl,
    );

    const redirect = new URL(response.headers.get("location") ?? "");
    const code = redirect.searchParams.get("code") ?? "";
    expect(response.status).toBe(302);
    expect(code).toBeTruthy();
    expect(redirect.searchParams.get("state")).toBe("state-123");

    const tokenResponse = await exchangeCode(oauth, client, code);
    const tokenBody = (await tokenResponse.json()) as TokenResponse;
    const authInfo = await oauth.verifyAccessToken(tokenBody.access_token);

    expect(tokenResponse.status).toBe(200);
    expect(authInfo.scopes).toEqual(["luma.events.read"]);
    expect(authInfo.resource?.href).toBe("https://mcp.example.com/mcp");
  });

  test("authorize form CSP allows posting back to the public server origin", async () => {
    const oauth = makeOAuth();
    const challenge = await pkceChallenge(verifier);
    const client = await registerPublicClient(oauth);

    const response = await oauth.authorize(
      new Request(authorizeUrl(client, { challenge, resource: defaultResource })),
      baseUrl,
    );

    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'self' https://mcp.example.com",
    );
  });

  test("local authorize form CSP does not constrain form-action for inspector redirects", async () => {
    const oauth = makeOAuth();
    const challenge = await pkceChallenge(verifier);
    const client = await registerPublicClient(oauth);

    const response = await oauth.authorize(
      new Request(authorizeUrl(client, { challenge, resource: "http://localhost:3000/mcp" })),
      localBaseUrl,
    );

    expect(response.headers.get("content-security-policy")).not.toContain("form-action");
  });

  test("rejects unsupported authorize scopes instead of broadening the grant", async () => {
    const oauth = makeOAuth();
    const client = await registerPublicClient(oauth);

    const response = await oauth.authorize(
      new Request(
        authorizeUrl(client, {
          challenge: "test-code-challenge",
          scope: "luma.events.read luma.admin",
        }),
      ),
      baseUrl,
    );
    const body = (await response.json()) as { error: string; error_description: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_scope");
    expect(body.error_description).toContain("luma.admin");
  });

  test("rejects access tokens issued for a different resource", async () => {
    const oauth = makeOAuth();
    const challenge = await pkceChallenge(verifier);
    const client = await registerPublicClient(oauth);

    const authorizeForm = await oauth.authorize(
      new Request(authorizeUrl(client, { challenge, resource: "https://other.example.com/mcp" })),
      baseUrl,
    );
    const csrfToken = extractInput(await authorizeForm.text(), "csrf_token");
    const authorizePost = await authorizeWithLumaKey(oauth, csrfToken);
    const code = new URL(authorizePost.headers.get("location") ?? "").searchParams.get("code") ?? "";
    const tokenResponse = await exchangeCode(oauth, client, code, {
      resource: "https://other.example.com/mcp",
    });
    const tokenBody = (await tokenResponse.json()) as TokenResponse;

    await expect(
      oauth.verifyAccessToken(tokenBody.access_token, new URL("https://mcp.example.com/mcp")),
    ).rejects.toThrow("different OAuth resource");
  });

  test("authorization codes can only be redeemed once under concurrent token requests", async () => {
    const oauth = makeOAuth();
    const challenge = await pkceChallenge(verifier);
    const client = await registerPublicClient(oauth);

    const authorizeForm = await oauth.authorize(
      new Request(authorizeUrl(client, { challenge, resource: defaultResource })),
      baseUrl,
    );
    const csrfToken = extractInput(await authorizeForm.text(), "csrf_token");
    const authorizePost = await authorizeWithLumaKey(oauth, csrfToken);
    const code = new URL(authorizePost.headers.get("location") ?? "").searchParams.get("code") ?? "";
    const makeTokenRequest = () => exchangeCode(oauth, client, code);

    const statuses = (await Promise.all([makeTokenRequest(), makeTokenRequest()]))
      .map((response) => response.status)
      .sort();

    expect(statuses).toEqual([200, 400]);
  });
});

function makeOAuth(fetcher: Fetcher = async () => Response.json({ entries: [] })) {
  return new RailwayOAuthServer({
    storagePath: join(mkdtempSync(join(tmpdir(), "luma-mcp-test-")), "oauth.sqlite"),
    appSecret,
    fetcher,
  });
}

async function registerPublicClient(
  oauth: RailwayOAuthServer,
  metadata: Record<string, unknown> = {},
): Promise<RegisteredClientResponse> {
  const response = await oauth.registerClient(
    new Request("https://mcp.example.com/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        ...metadata,
      }),
    }),
  );

  return (await response.json()) as RegisteredClientResponse;
}

function authorizeUrl(
  client: RegisteredClientResponse,
  options: {
    challenge: string;
    scope?: string;
    state?: string;
    resource?: string;
  },
): string {
  const url = new URL("/authorize", baseUrl);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", options.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", options.scope ?? "luma.events.read");
  if (options.state) {
    url.searchParams.set("state", options.state);
  }
  if (options.resource) {
    url.searchParams.set("resource", options.resource);
  }
  return url.href;
}

async function authorizeWithLumaKey(
  oauth: RailwayOAuthServer,
  csrfToken: string,
): Promise<Response> {
  return oauth.authorize(
    new Request("https://mcp.example.com/authorize", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrf_token: csrfToken,
        luma_api_key: "luma-valid-key",
      }),
    }),
    baseUrl,
  );
}

async function exchangeCode(
  oauth: RailwayOAuthServer,
  client: RegisteredClientResponse,
  code: string,
  options: { resource?: string } = {},
): Promise<Response> {
  return oauth.token(
    new Request("https://mcp.example.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.client_id,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        resource: options.resource ?? defaultResource,
      }),
    }),
  );
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function extractInput(html: string, name: string): string {
  const match = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
  if (!match) {
    throw new Error(`Missing ${name} input`);
  }
  return match[1];
}

function makeRequest(input: string | URL | Request, init?: RequestInit): Request {
  if (input instanceof Request) {
    return new Request(input, init);
  }

  return new Request(input.toString(), init);
}
