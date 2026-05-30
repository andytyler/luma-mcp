import { describe, expect, test } from "bun:test";
import {
  escapeHtml,
  hashApiKey,
  renderAuthorizePage,
  buildAuthorizationProps,
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
    expect(html).toContain("Luma calendar or organization API key");
    expect(html).toContain("luma.events.read");
    expect(html).toContain("luma.events.write");
  });

  test("renderAuthorizePage guards against duplicate authorization submits", () => {
    const html = renderAuthorizePage({
      csrfToken: "csrf-123",
      scriptNonce: "test-nonce",
    });

    expect(html).toContain('data-authorize-form="true"');
    expect(html).toContain('<script nonce="test-nonce">');
    expect(html).toContain("button.disabled = true");
    expect(html).toContain("Authorizing...");
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

  test("buildAuthorizationProps does not broaden unsupported requested scopes", async () => {
    const result = await buildAuthorizationProps("luma-secret-key", ["luma.admin"]);

    expect(result.scope).toEqual([]);
    expect(result.props.scopes).toEqual([]);
  });
});
