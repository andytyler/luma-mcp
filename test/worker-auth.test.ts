import { describe, expect, test } from "bun:test";
import type { AuthRequest, ClientInfo, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Fetcher } from "../src/luma-api";
import { handleAuthorize } from "../src/worker-auth";

class MemoryKV {
  values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("worker auth flow", () => {
  test("GET /authorize stores the OAuth request under a CSRF-bound KV key", async () => {
    const env = makeEnv();
    const response = await handleAuthorize(
      new Request("https://mcp.example.com/authorize?client_id=client-123"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("set-cookie")).toContain("__Host-luma_mcp_csrf=");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");

    const html = await response.text();
    const token = extractCsrfToken(html);
    expect(token).toBeTruthy();
    expect(env.OAUTH_KV.values.get(`oauth-request:${token}`)).toContain("client-123");
    expect(html).toContain("Test MCP Client");
  });

  test("POST /authorize validates the Luma API key and completes OAuth authorization", async () => {
    const env = makeEnv();
    const getResponse = await handleAuthorize(
      new Request("https://mcp.example.com/authorize?client_id=client-123"),
      env,
    );
    const token = extractCsrfToken(await getResponse.text());
    const fetcher: Fetcher = async (input, init) => {
      const request = new Request(input, init);
      expect(request.url).toBe(
        "https://public-api.luma.com/v1/calendar/list-events?pagination_limit=1",
      );
      expect(request.headers.get("x-luma-api-key")).toBe("luma-valid-key");
      return Response.json({ entries: [] });
    };

    const body = new URLSearchParams({
      csrf_token: token,
      luma_api_key: "luma-valid-key",
    });
    const response = await handleAuthorize(
      new Request("https://mcp.example.com/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `__Host-luma_mcp_csrf=${encodeURIComponent(token)}`,
        },
        body,
      }),
      env,
      fetcher,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://client.example.com/callback?code=ok");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(env.completeAuthorizationCalls).toHaveLength(1);
    expect(env.completeAuthorizationCalls[0].request.clientId).toBe("client-123");
    expect(env.completeAuthorizationCalls[0].props.lumaApiKey).toBe("luma-valid-key");
    expect(JSON.stringify(env.completeAuthorizationCalls[0].metadata)).not.toContain(
      "luma-valid-key",
    );
  });

  test("POST /authorize rejects mismatched CSRF tokens", async () => {
    const env = makeEnv();
    const response = await handleAuthorize(
      new Request("https://mcp.example.com/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: "__Host-luma_mcp_csrf=cookie-token",
        },
        body: new URLSearchParams({
          csrf_token: "form-token",
          luma_api_key: "luma-valid-key",
        }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(env.completeAuthorizationCalls).toHaveLength(0);
  });

  test("POST /authorize escapes upstream validation errors", async () => {
    const env = makeEnv();
    const getResponse = await handleAuthorize(
      new Request("https://mcp.example.com/authorize?client_id=client-123"),
      env,
    );
    const token = extractCsrfToken(await getResponse.text());
    const fetcher: Fetcher = async () =>
      new Response(`<script>alert("x")</script>`, { status: 401 });

    const response = await handleAuthorize(
      new Request("https://mcp.example.com/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `__Host-luma_mcp_csrf=${encodeURIComponent(token)}`,
        },
        body: new URLSearchParams({
          csrf_token: token,
          luma_api_key: "bad-key",
        }),
      }),
      env,
      fetcher,
    );

    const html = await response.text();
    expect(response.status).toBe(401);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

function makeEnv() {
  const authRequest: AuthRequest = {
    responseType: "code",
    clientId: "client-123",
    redirectUri: "https://client.example.com/callback",
    scope: ["luma.events.read", "luma.events.write"],
    state: "state-123",
    codeChallenge: "challenge",
    codeChallengeMethod: "S256",
  };
  const clientInfo: ClientInfo = {
    clientId: "client-123",
    redirectUris: ["https://client.example.com/callback"],
    clientName: "Test MCP Client",
    logoUri: "https://client.example.com/logo.png",
    tokenEndpointAuthMethod: "none",
  };
  const completeAuthorizationCalls: Parameters<OAuthHelpers["completeAuthorization"]>[0][] = [];
  const OAUTH_KV = new MemoryKV();

  return {
    OAUTH_KV,
    completeAuthorizationCalls,
    OAUTH_PROVIDER: {
      parseAuthRequest: async () => authRequest,
      lookupClient: async () => clientInfo,
      completeAuthorization: async (options) => {
        completeAuthorizationCalls.push(options);
        return { redirectTo: "https://client.example.com/callback?code=ok" };
      },
    } satisfies Partial<OAuthHelpers>,
  };
}

function extractCsrfToken(html: string): string {
  const match = html.match(/name="csrf_token" value="([^"]+)"/);
  if (!match) {
    throw new Error("Missing CSRF token");
  }
  return match[1];
}
