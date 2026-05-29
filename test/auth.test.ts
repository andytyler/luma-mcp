import { describe, expect, test } from "bun:test";
import {
  createCsrfCookie,
  escapeHtml,
  hashApiKey,
  renderAuthorizePage,
  buildAuthorizationProps,
  parseCookies,
  sanitizeHttpUrl,
} from "../src/auth";

describe("auth helpers", () => {
  test("escapeHtml renders untrusted OAuth client metadata safely", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;",
    );
  });

  test("sanitizeHttpUrl only allows http and https URLs", () => {
    expect(sanitizeHttpUrl("https://example.com/logo.png")).toBe(
      "https://example.com/logo.png",
    );
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeHttpUrl("not a url")).toBe("");
  });

  test("createCsrfCookie uses a host-only secure cookie", () => {
    const cookie = createCsrfCookie("token-123", 600);

    expect(cookie).toContain("__Host-luma_mcp_csrf=token-123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });

  test("parseCookies handles spaces and encoded values", () => {
    expect(parseCookies("a=1; theme=light%20mode; empty=")).toEqual({
      a: "1",
      theme: "light mode",
      empty: "",
    });
  });

  test("hashApiKey produces a stable non-secret user id suffix", async () => {
    const first = await hashApiKey("luma-secret");
    const second = await hashApiKey("luma-secret");

    expect(first).toBe(second);
    expect(first).not.toContain("luma-secret");
    expect(first).toHaveLength(64);
  });

  test("renderAuthorizePage includes sanitized client metadata and a hidden CSRF token", () => {
    const html = renderAuthorizePage({
      csrfToken: "csrf-123",
      clientName: `<script>alert("bad")</script>`,
      logoUri: "javascript:alert(1)",
      scopes: ["luma.events.read", "luma.events.write"],
    });

    expect(html).toContain("&lt;script&gt;alert(&quot;bad&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain('name="csrf_token" value="csrf-123"');
    expect(html).toContain("luma.events.read");
    expect(html).toContain("luma.events.write");
  });

  test("buildAuthorizationProps keeps secrets in props and non-secrets in grant metadata", async () => {
    const result = await buildAuthorizationProps("luma-secret-key");

    expect(result.props.lumaApiKey).toBe("luma-secret-key");
    expect(result.props.lumaApiKeyHash).toBe(result.metadata.apiKeyHash);
    expect(result.props.scopes).toEqual(["luma.events.read", "luma.events.write"]);
    expect(result.userId).toBe(`luma:${result.metadata.apiKeyHash.slice(0, 16)}`);
    expect(JSON.stringify(result.metadata)).not.toContain("luma-secret-key");
  });

  test("buildAuthorizationProps preserves requested read-only scope in encrypted props", async () => {
    const result = await buildAuthorizationProps("luma-secret-key", ["luma.events.read"]);

    expect(result.scope).toEqual(["luma.events.read"]);
    expect(result.props.scopes).toEqual(["luma.events.read"]);
  });
});
