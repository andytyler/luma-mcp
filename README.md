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
is set.

Useful local URLs:

```text
http://localhost:3000/
http://localhost:3000/health
http://localhost:3000/mcp
```

Debug with MCP Inspector over Streamable HTTP:

```sh
APP_SECRET="replace-with-a-random-32-character-secret" bun run dev   # terminal 1
bun run inspect                                                      # terminal 2
```

Inspector connects to `http://localhost:3000/mcp`. Complete OAuth in the inspector UI and paste your Luma API key on the authorize page when prompted. Tool calls then use the bearer token from that flow.

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

Required Railway variables:

```sh
APP_SECRET=<random 32+ character secret>
MCP_BASE_URL=https://<service-domain>
```

Railway also provides `RAILWAY_PUBLIC_DOMAIN`, and the server will use it when
`MCP_BASE_URL` is not set. Set `MCP_BASE_URL` explicitly for custom domains.

Required Railway volume:

```sh
railway volume add --mount-path /data
```

The server stores OAuth clients, tokens, refresh tokens, and encrypted Luma API
keys in SQLite. In production, mount a volume so those grants survive restarts
and redeploys. With the volume above, data is stored at
`$RAILWAY_VOLUME_MOUNT_PATH/luma-mcp.sqlite`; you can override that with
`MCP_STORAGE_PATH`. Local development without a volume falls back to
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
in SQLite, and only a hash is kept in non-secret metadata.

## Verification

```sh
bun run check
```
