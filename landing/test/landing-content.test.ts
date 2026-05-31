import { describe, expect, test } from "bun:test";

const app = await Bun.file(new URL("../src/App.svelte", import.meta.url)).text();
const appCss = await Bun.file(new URL("../src/app.css", import.meta.url)).text();
const capabilities = await Bun.file(new URL("../src/lib/components/Capabilities.svelte", import.meta.url)).text();
const caddyfile = await Bun.file(new URL("../Caddyfile", import.meta.url)).text();
const install = await Bun.file(new URL("../src/lib/components/Install.svelte", import.meta.url)).text();
const index = await Bun.file(new URL("../index.html", import.meta.url)).text();
const nav = await Bun.file(new URL("../src/lib/components/Nav.svelte", import.meta.url)).text();
const railwayConfig = await Bun.file(new URL("../railway.toml", import.meta.url)).text();
const site = await Bun.file(new URL("../src/lib/site.ts", import.meta.url)).text();

describe("landing page content", () => {
  test("nav links use real destinations", () => {
    expect(site).toContain('href: `${SITE.githubUrl}#readme`');
    expect(site).toContain("href: ENDPOINT");
    expect(site).toContain("href: SITE.githubUrl");
    expect(nav).toContain("{#each NAV_LINKS as link");
    expect(nav).not.toContain('href="/" aria-label={link}');
    expect(site).not.toContain('"Deploy"');
  });

  test("config snippets are not rendered as shell commands", () => {
    expect(site).toContain('language: "shell"');
    expect(site).toContain('language: "json"');
    expect(site).toContain('language: "url"');
    expect(install).toContain('agent.language === "shell"');
    expect(install).toContain("{command}");
  });

  test("capabilities list the Luma MCP tool catalog", () => {
    const actionIds = Array.from(site.matchAll(/id: "(luma_[^"]+)"/g), ([, id]) => id);

    expect(actionIds.length).toBeGreaterThanOrEqual(20);
    expect(actionIds).toContain("luma_create_event");
    expect(actionIds).toContain("luma_request");
    expect(capabilities).toContain("{#each ACTIONS as action");
  });

  test("uses Instrument Sans as the primary landing font", () => {
    expect(appCss).toContain('@import "@fontsource-variable/instrument-sans"');
    expect(appCss).toContain("--font-sans: 'Instrument Sans Variable'");
    expect(appCss).not.toContain("@fontsource-variable/inter");
    expect(appCss).not.toContain("@fontsource-variable/geist");
  });

  test("document head includes share metadata and a favicon", () => {
    expect(index).toContain('rel="icon"');
    expect(index).toContain('property="og:title"');
    expect(index).toContain('property="og:image"');
    expect(index).toContain('name="twitter:card"');
  });

  test("landing metadata uses the landing domain while install snippets keep the hosted MCP endpoint", () => {
    expect(index).toContain('property="og:url" content="https://luma-mcp.ajt.dev/"');
    expect(index).toContain('content="https://luma-mcp.ajt.dev/og.svg"');
    expect(site).toContain('mcpBaseUrl: "https://luma-mcp-production.up.railway.app"');
    expect(site).not.toContain('mcpBaseUrl: "https://luma-mcp.ajt.dev"');
  });

  test("Caddy serves health before the SPA fallback", () => {
    expect(caddyfile).toContain("route {");
    expect(caddyfile.indexOf('respond /health "ok" 200')).toBeLessThan(caddyfile.indexOf("try_files {path} /index.html"));
  });

  test("Railway config does not skip path-as-root landing deploys", () => {
    expect(railwayConfig).not.toContain('watchPatterns = ["/landing/**"]');
  });
});
