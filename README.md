# Luma MCP

Remote MCP server for Luma, deployable on Cloudflare Workers or Railway.

The server exposes `/mcp` as an OAuth-protected Streamable HTTP MCP endpoint. During OAuth authorization, a user pastes a Luma calendar API key. The Cloudflare OAuth provider stores that key only inside encrypted OAuth props, then passes it to MCP tool calls for that user.

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

`luma_request` is a safe generic escape hatch for Luma endpoints not yet wrapped by a named tool. It only accepts relative `/v1/` paths and `GET` or `POST`.

## Setup

Install dependencies:

```sh
bun install
```

Create the OAuth KV namespace:

```sh
bunx wrangler kv namespace create OAUTH_KV
```

Copy the returned namespace ID into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "your-kv-namespace-id"
  }
]
```

Run locally:

```sh
bun run dev
```

Deploy:

```sh
bun run deploy
```

After deployment, the MCP endpoint is:

```text
https://<worker-name>.<account-subdomain>.workers.dev/mcp
```

## Railway Production

Railway runs the Bun entrypoint in `src/railway.ts`. It exposes the same `/mcp`
Streamable HTTP endpoint with OAuth, plus `/health` for Railway health checks.

Required Railway variables:

```sh
APP_SECRET=<random 32+ character secret>
```

Recommended Railway volume:

```sh
railway volume add --mount-path /data
```

When a Railway volume is attached, the OAuth client, token, and encrypted Luma
API-key props database is stored at `$RAILWAY_VOLUME_MOUNT_PATH/luma-mcp.sqlite`.
Without a volume, local development falls back to `./data/luma-mcp.sqlite`.

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
npx mcp-remote https://<worker-name>.<account-subdomain>.workers.dev/mcp
```

Example Codex registration:

```sh
codex mcp add luma -- npx mcp-remote https://<worker-name>.<account-subdomain>.workers.dev/mcp
```

## Luma Auth Model

Luma's public API currently uses API keys. Each person connecting this MCP server needs a Luma API key for the calendar or organization they want to manage. The authorize page validates the key with low-cost calendar and organization probes before completing OAuth.

Luma API keys are scoped. A user can reconnect the MCP server to rotate or replace the key for a client.

## Verification

```sh
bun run check
bunx wrangler deploy --dry-run
```
