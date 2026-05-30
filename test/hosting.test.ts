import { describe, expect, test } from "bun:test";
import { corsHeaders, publicBaseUrl } from "../src/hosting";

describe("hosting helpers", () => {
  test("prefers MCP_BASE_URL over request headers", () => {
    const request = new Request("http://spoofed.example.com/mcp", {
      headers: {
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
      },
    });

    expect(
      publicBaseUrl(request, { MCP_BASE_URL: "https://configured.example.com" }).href,
    ).toBe("https://configured.example.com/");
  });

  test("uses Railway public domain before forwarded headers", () => {
    const request = new Request("http://internal.example.com/mcp", {
      headers: {
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "http",
      },
    });

    expect(
      publicBaseUrl(request, { RAILWAY_PUBLIC_DOMAIN: "luma-mcp.up.railway.app" }).href,
    ).toBe("https://luma-mcp.up.railway.app/");
  });

  test("corsHeaders echoes browser origins and requested headers", () => {
    const headers = corsHeaders(
      new Request("http://localhost:3000/.well-known/oauth-protected-resource/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:6274",
          "access-control-request-headers": "content-type, authorization",
        },
      }),
    );

    expect(headers["access-control-allow-origin"]).toBe("http://localhost:6274");
    expect(headers["access-control-allow-methods"]).toContain("OPTIONS");
    expect(headers["access-control-allow-headers"]).toBe("content-type, authorization");
    expect(headers["access-control-expose-headers"]).toContain("www-authenticate");
  });
});
