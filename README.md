# Luma MCP

Remote MCP server for Luma, hosted on Railway.

The server exposes `/mcp` as an OAuth-protected Streamable HTTP MCP endpoint.
During authorization, a user pastes a Luma API key. The Railway runtime validates
that key with Luma, encrypts it, and stores the OAuth client, token, and grant
state in SQLite.

## What It Provides

- A Railway/Bun HTTP server in `src/railway.ts`
- OAuth discovery, client registration, token exchange, refresh, and revoke endpoints
- Encrypted per-user Luma API key storage in SQLite
- A `/health` endpoint for Railway health checks
- MCP tools for Luma calendar, event, guest, ticket, coupon, tag, upload, and host APIs
- `luma_request`, a safe generic escape hatch for any relative `/v1/` Luma `GET` or `POST` endpoint

## Tools

- `luma_get_calendar`
- `luma_list_events`
- `luma_get_event`
- `luma_create_event`
- `luma_update_event`
- `luma_add_guests`
- `luma_send_invites`
- `luma_update_guest_status`
- `luma_get_guest`
- `luma_list_ticket_types`
- `luma_create_ticket_type`
- `luma_update_ticket_type`
- `luma_create_coupon`
- `luma_update_coupon`
- `luma_list_calendar_coupons`
- `luma_create_calendar_coupon`
- `luma_update_calendar_coupon`
- `luma_list_event_tags`
- `luma_create_event_tag`
- `luma_apply_event_tag`
- `luma_create_upload_url`
- `luma_create_host`
- `luma_update_host`
- `luma_request`

## Local Development

Install dependencies:

```sh
bun install
```

Run the server:

```sh
APP_SECRET="replace-with-a-random-32-character-secret" bun run dev
```

Local OAuth data is stored in `./data/luma-mcp.sqlite` unless `MCP_STORAGE_PATH`
or `RAILWAY_VOLUME_MOUNT_PATH` is set. Storage path resolution is
`MCP_STORAGE_PATH`, then `$RAILWAY_VOLUME_MOUNT_PATH/luma-mcp.sqlite`, then
`./data/luma-mcp.sqlite`.

Useful local URLs:

```text
http://localhost:3000/
http://localhost:3000/health
http://localhost:3000/mcp
```

By default the server listens on `0.0.0.0:3000`; override with `HOST` and
`PORT`. If you change `PORT`, update `inspector.json` too.

Debug with MCP Inspector over Streamable HTTP:

```sh
APP_SECRET="replace-with-a-random-32-character-secret" bun run dev   # terminal 1
bun run inspect                                                      # terminal 2
```

Inspector connects to `http://localhost:3000/mcp`. Complete OAuth in the inspector UI and paste your Luma API key on the authorize page when prompted. Tool calls then use the bearer token from that flow.

For local Inspector compatibility, browser origins are reflected on `/mcp`,
OAuth register/token/revoke, and well-known discovery routes. Authorize pages
intentionally omit `form-action` CSP so browser-based OAuth flows can submit
the Luma API key form back to the server origin chosen by the client.

## Railway Deployment

Railway uses `railway.toml`:

```toml
[build]
builder = "RAILPACK"

[deploy]
startCommand = "bun run start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ALWAYS"
```

Required Railway variable:

```sh
APP_SECRET=<random 32+ character secret>
```

Optional Railway variable:

```sh
MCP_BASE_URL=https://<custom-domain>
```

Railway provides `RAILWAY_PUBLIC_DOMAIN`, and the server will use it when
`MCP_BASE_URL` is not set. Set `MCP_BASE_URL` explicitly for custom domains.

Production Railway volume, required for OAuth grants to survive restarts and
redeploys:

```sh
railway volume add --mount-path /data
```

The server stores OAuth clients, tokens, refresh tokens, and encrypted Luma API
keys in SQLite. In production, mount a volume so those grants survive restarts
and redeploys. With the volume above, data is stored at
`$RAILWAY_VOLUME_MOUNT_PATH/luma-mcp.sqlite`; you can override that with
`MCP_STORAGE_PATH`. Without either variable, the server falls back to
`./data/luma-mcp.sqlite`.

Deploy from the linked Railway service:

```sh
bun run check
railway up
```

After deployment, generate a public Railway domain and use:

```text
https://<service-domain>/mcp
```

## Landing Page Deployment

The landing page is a separate Railway service from the same repository. Keep
the MCP service on the repo root with `/railway.toml`; do not repoint the MCP
service to `luma-mcp.ajt.dev` unless you intend to move the MCP endpoint.

Create a second Railway service and configure it with:

```text
Root Directory: /landing
Config File Path: /landing/railway.toml
Custom Domain: luma-mcp.ajt.dev
```

The landing service uses `landing/Dockerfile`, builds the Vite app with Bun,
and serves the static `dist` directory with Caddy on Railway's `$PORT`. It has
its own `/health` endpoint in `landing/Caddyfile`.

Attach `luma-mcp.ajt.dev` only to the landing service. Add the `CNAME` and
`TXT` records Railway shows in the custom-domain flow; the `TXT` record is
required for Railway to route the domain after DNS resolves.

The hosted install snippets still point at the current MCP endpoint:

```text
https://luma-mcp-production.up.railway.app/mcp
```

## Client Usage

Use the `/mcp` URL directly in clients that support remote MCP with OAuth.

For MCP clients that only accept stdio commands, use `mcp-remote`:

```sh
npx mcp-remote https://<service-domain>/mcp
```

Example Codex registration:

```sh
codex mcp add luma -- npx mcp-remote https://<service-domain>/mcp
```

## Luma Auth Model

Luma's public API uses API keys. Each person connecting this MCP server needs a
Luma API key for the calendar or organization they want to manage.

The authorize page validates the key with low-cost calendar and organization
probes before completing OAuth. The raw API key is encrypted before it is stored
in SQLite. The API key and its SHA-256 hash are stored only inside encrypted
OAuth token props; the raw key is never written outside that encrypted value.

## Verification

```sh
bun run check
```
