export const SITE = {
  productName: "Luma MCP",
  headline: "Install Luma MCP",
  description: "An unofficial, OAuth-protected MCP server that connects your AI assistant to Luma — manage events, guests, and tickets right from chat.",
  disclaimer: "Unofficial — not built by, affiliated with, or endorsed by Lu.ma.",
  mcpBaseUrl: "https://luma-mcp-production.up.railway.app",
  endpointPath: "/mcp",
  githubUrl: "https://github.com/andytyler/luma-mcp",
  lumaApiDocsUrl: "https://docs.lu.ma/reference/getting-started-with-your-api",
  footer: { lead: "Created by", name: "Andy Tyler", program: "Codex Community Program", url: "https://ajt.dev" },
};

export const ENDPOINT = new URL(SITE.endpointPath, SITE.mcpBaseUrl).href;

export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Docs", href: `${SITE.githubUrl}#readme` },
  { label: "Endpoint", href: ENDPOINT },
  { label: "GitHub", href: SITE.githubUrl },
];

// Endpoint used when running the server on your own machine (see LOCAL_SETUP).
export const LOCAL_ENDPOINT = "http://localhost:3000/mcp";

export type Agent = {
  name: string;
  iconUrl: string;
  language: "shell" | "json" | "url";
  note: string;
  // Builds the setup value for a given MCP endpoint (hosted or local).
  build: (endpoint: string) => string;
};

// Codex CLI: stable path for a remote OAuth server is the mcp-remote stdio bridge.
const codexCommand = (endpoint: string) => `codex mcp add luma -- npx mcp-remote ${endpoint}`;
// Claude Code: native streamable-HTTP transport with built-in OAuth.
const claudeCommand = (endpoint: string) => `claude mcp add --transport http luma ${endpoint}`;
// Cursor: native remote server entry for ~/.cursor/mcp.json (OAuth handled in-app).
const cursorConfig = (endpoint: string) => JSON.stringify({ mcpServers: { luma: { url: endpoint } } }, null, 2);
// VS Code (Copilot): mcp.json uses a "servers" key and an explicit "type".
const vscodeConfig = (endpoint: string) => JSON.stringify({ servers: { luma: { type: "http", url: endpoint } } }, null, 2);
// Windsurf: mcp_config.json uses "serverUrl" for streamable-HTTP servers.
const windsurfConfig = (endpoint: string) => JSON.stringify({ mcpServers: { luma: { serverUrl: endpoint } } }, null, 2);

export const AGENTS: Agent[] = [
  {
    name: "Codex",
    iconUrl: "/agent-icons/codex.png",
    language: "shell",
    note: "Bridges to the remote server with mcp-remote, then opens your browser to authorize.",
    build: codexCommand,
  },
  {
    name: "Claude",
    iconUrl: "/agent-icons/claude.png",
    language: "shell",
    note: "Adds the server to Claude Code; it opens your browser to authorize. (Claude Desktop: add the URL as a custom connector.)",
    build: claudeCommand,
  },
  {
    name: "Cursor",
    iconUrl: "/agent-icons/cursor.png",
    language: "json",
    note: "Add to ~/.cursor/mcp.json — Cursor opens your browser to authorize.",
    build: cursorConfig,
  },
  {
    name: "VS Code",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=code.visualstudio.com",
    language: "json",
    note: "Add to .vscode/mcp.json (or run “MCP: Add Server”) — VS Code handles the OAuth sign-in.",
    build: vscodeConfig,
  },
  {
    name: "Windsurf",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=windsurf.com",
    language: "json",
    note: "Add to ~/.codeium/windsurf/mcp_config.json, then restart Windsurf.",
    build: windsurfConfig,
  },
  {
    name: "ChatGPT",
    iconUrl: "/agent-icons/chatgpt.webp",
    language: "url",
    note: "Add as a remote MCP connector under Settings → Connectors (developer mode).",
    build: (endpoint) => endpoint,
  },
];

// Run-once steps to host the MCP server on your own machine.
export type SetupStep = { label: string; command: string };

export type PackageManager = "bun" | "pnpm" | "npm";
export const PACKAGE_MANAGERS: PackageManager[] = ["bun", "pnpm", "npm"];

const PM_INSTALL: Record<PackageManager, string> = { bun: "bun install", pnpm: "pnpm install", npm: "npm install" };
const PM_RUN: Record<PackageManager, string> = { bun: "bun run dev", pnpm: "pnpm dev", npm: "npm run dev" };

export function buildLocalSetup(pm: PackageManager): SetupStep[] {
  return [
    { label: "Clone the repo", command: `git clone ${SITE.githubUrl}.git && cd luma-mcp` },
    { label: "Install dependencies", command: PM_INSTALL[pm] },
    { label: "Start the server", command: `APP_SECRET="$(openssl rand -hex 16)" ${PM_RUN[pm]}` },
  ];
}

export type Action = { id: string; title: string; description: string };

// A neutral glyph instead of Luma's official mark — this project is unofficial.
export const LUMA_TOOL_GLYPH = "❇️";

export const ACTIONS: Action[] = [
  {
    id: "luma_get_calendar",
    title: "Get Luma Calendar",
    description: "Get information about the Luma calendar attached to the authorized API key.",
  },
  {
    id: "luma_list_events",
    title: "List Luma Events",
    description: "List events managed by the authorized Luma calendar. Supports pagination and basic filters.",
  },
  {
    id: "luma_get_event",
    title: "Get Luma Event",
    description: "Return admin information for an event the authorized calendar can manage.",
  },
  {
    id: "luma_create_event",
    title: "Create Luma Event",
    description: "Create an event in the authorized Luma calendar.",
  },
  {
    id: "luma_update_event",
    title: "Update Luma Event",
    description: "Update an existing Luma event.",
  },
  {
    id: "luma_add_guests",
    title: "Add Luma Guests",
    description: "Add guests to a Luma event with status Going. Optionally assign ticket details.",
  },
  {
    id: "luma_send_invites",
    title: "Send Luma Invites",
    description: "Invite guests to a Luma event by email, optionally with a short message.",
  },
  {
    id: "luma_update_guest_status",
    title: "Update Luma Guest Status",
    description: "Update a guest registration status. Use Luma's accepted identifiers and status values.",
  },
  {
    id: "luma_get_guest",
    title: "Get Luma Guest",
    description: "Get detailed information for an event guest by guest ID, ticket key, guest key, or email.",
  },
  {
    id: "luma_list_ticket_types",
    title: "List Luma Ticket Types",
    description: "List all ticket types for a Luma event.",
  },
  {
    id: "luma_create_ticket_type",
    title: "Create Luma Ticket Type",
    description: "Create a free or paid ticket type for a Luma event.",
  },
  {
    id: "luma_update_ticket_type",
    title: "Update Luma Ticket Type",
    description: "Update an existing Luma event ticket type.",
  },
  {
    id: "luma_create_coupon",
    title: "Create Luma Coupon",
    description: "Create an event coupon for a Luma event.",
  },
  {
    id: "luma_update_coupon",
    title: "Update Luma Event Coupon",
    description: "Update event coupon availability dates or remaining count.",
  },
  {
    id: "luma_list_calendar_coupons",
    title: "List Luma Calendar Coupons",
    description: "List all coupons created for the authorized Luma calendar.",
  },
  {
    id: "luma_create_calendar_coupon",
    title: "Create Luma Calendar Coupon",
    description: "Create a coupon that can apply to any event managed by the calendar.",
  },
  {
    id: "luma_update_calendar_coupon",
    title: "Update Luma Calendar Coupon",
    description: "Update calendar coupon availability dates or remaining count.",
  },
  {
    id: "luma_list_event_tags",
    title: "List Luma Event Tags",
    description: "List event tags available on the authorized Luma calendar.",
  },
  {
    id: "luma_create_event_tag",
    title: "Create Luma Event Tag",
    description: "Create an event tag on the authorized Luma calendar.",
  },
  {
    id: "luma_apply_event_tag",
    title: "Apply Luma Event Tag",
    description: "Apply a tag to one or more events on the authorized Luma calendar.",
  },
  {
    id: "luma_create_upload_url",
    title: "Create Luma Image Upload URL",
    description: "Create a Luma CDN upload URL for cover images used in events.",
  },
  {
    id: "luma_create_host",
    title: "Create Luma Event Host",
    description: "Add a manager or check-in host to a Luma event.",
  },
  {
    id: "luma_update_host",
    title: "Update Luma Event Host",
    description: "Update a host's permissions or visibility on a Luma event.",
  },
  {
    id: "luma_request",
    title: "Call Luma API",
    description:
      "Call any current Luma public API endpoint under /v1 using the authorized API key. Use this when a specific endpoint is not exposed as a named tool.",
  },
];
