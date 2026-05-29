import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { RailwayOAuthServer } from "../src/railway-oauth";
import type { Fetcher } from "../src/luma-api";

const appSecret = "test-secret-with-at-least-thirty-two-characters";
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
      const request = new Request(input, init);
      lumaValidationCalls.push(request);
      return Response.json({ entries: [] });
    };
    const oauth = new RailwayOAuthServer({
      storagePath: join(mkdtempSync(join(tmpdir(), "luma-mcp-test-")), "oauth.sqlite"),
      appSecret,
      fetcher,
    });
    const baseUrl = new URL("https://mcp.example.com");
    const redirectUri = "https://client.example.com/callback";
    const verifier = "test-code-verifier-that-is-long-enough";
    const challenge = await pkceChallenge(verifier);

    const registration = await oauth.registerClient(
      new Request("https://mcp.example.com/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
          client_name: "Test MCP Client",
        }),
      }),
    );
    const client = (await registration.json()) as RegisteredClientResponse;

    const authorizeUrl = new URL("/authorize", baseUrl);
    authorizeUrl.searchParams.set("client_id", client.client_id);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("scope", "luma.events.read");
    authorizeUrl.searchParams.set("state", "state-123");
    authorizeUrl.searchParams.set("resource", "https://mcp.example.com/mcp");

    const authorizeForm = await oauth.authorize(new Request(authorizeUrl), baseUrl);
    const authorizeHtml = await authorizeForm.text();
    const csrfToken = extractInput(authorizeHtml, "csrf_token");

    const authorizePostBody = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: "luma.events.read",
      state: "state-123",
      resource: "https://mcp.example.com/mcp",
      csrf_token: csrfToken,
      luma_api_key: "luma-valid-key",
    });
    const authorizePost = await oauth.authorize(
      new Request("https://mcp.example.com/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `__Host-luma_mcp_csrf=${encodeURIComponent(csrfToken)}`,
        },
        body: authorizePostBody,
      }),
      baseUrl,
    );

    const redirect = new URL(authorizePost.headers.get("location") ?? "");
    const code = redirect.searchParams.get("code") ?? "";
    expect(authorizePost.status).toBe(302);
    expect(redirect.searchParams.get("state")).toBe("state-123");
    expect(code).toBeTruthy();
    expect(lumaValidationCalls[0].headers.get("x-luma-api-key")).toBe("luma-valid-key");

    const tokenResponse = await oauth.token(
      new Request("https://mcp.example.com/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: client.client_id,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          resource: "https://mcp.example.com/mcp",
        }),
      }),
    );
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
});

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
