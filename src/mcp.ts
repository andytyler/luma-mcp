import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { lumaRequest, validateLumaPath, type Fetcher, type QueryParams } from "./luma-api";
import {
  getLumaAuthProps,
  hasRequiredScope,
  LUMA_TOOL_NAMES,
  makeToolError,
  makeToolResult,
  type AuthContextLike,
  type LumaAuthProps,
  type LumaScope,
} from "./mcp-helpers";

export { getLumaAuthProps, LUMA_TOOL_NAMES, makeToolError, makeToolResult };
export type { AuthContextLike, LumaAuthProps };

type JsonObject = Record<string, unknown>;
type ToolExtra = {
  authInfo?: {
    scopes?: string[];
    extra?: Record<string, unknown>;
  };
};

const eventId = z.string().min(1).describe("Luma event ID, usually starting with evt-");
const isoDateTime = z.string().datetime({ offset: true }).describe("ISO 8601 date-time, for example 2026-05-18T19:00:00.000Z");

const optionalJsonObject = z.record(z.unknown()).optional();
const anyJsonObject = z.record(z.unknown());
const guestList = z
  .array(
    z
      .object({
        email: z.string().email(),
        name: z.string().optional(),
      })
      .passthrough(),
  )
  .min(1);

export function createLumaMcpServer(fetcher: Fetcher = fetch): McpServer {
  const server = new McpServer({
    name: "luma-mcp",
    version: "0.1.0",
    description: "Luma MCP Server",
    websiteUrl: "https://luma.com",
    icons: [{ src: "https://luma.com/favicon.ico", mimeType: "image/x-icon" }],
    title: "Luma MCP Server",
  });

  server.registerTool(
    "luma_get_calendar",
    {
      title: "Get Luma Calendar",
      description: "Get information about the Luma calendar attached to the authorized API key.",
    },
    async (extra) => callLuma({ path: "/v1/calendar/get" }, fetcher, extra, "luma.events.read"),
  );

  server.registerTool(
    "luma_list_events",
    {
      title: "List Luma Events",
      description: "List events managed by the authorized Luma calendar. Supports pagination and basic filters.",
      inputSchema: {
        before: isoDateTime.optional(),
        after: isoDateTime.optional(),
        pagination_cursor: z.string().optional(),
        pagination_limit: z.number().int().positive().max(100).optional(),
        platforms: z.array(z.enum(["luma", "external"])).optional(),
        sort_column: z.enum(["start_at"]).optional(),
        sort_direction: z.enum(["asc", "desc", "asc nulls last", "desc nulls last"]).optional(),
        status: z.enum(["approved", "pending"]).optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          path: "/v1/calendar/list-events",
          query: cleanQuery(args),
        },
        fetcher,
        extra,
        "luma.events.read",
      ),
  );

  server.registerTool(
    "luma_get_event",
    {
      title: "Get Luma Event",
      description: "Return admin information for an event the authorized calendar can manage.",
      inputSchema: {
        event_id: eventId,
      },
    },
    async (args, extra) =>
      callLuma(
        {
          path: "/v1/event/get",
          query: cleanQuery(args),
        },
        fetcher,
        extra,
        "luma.events.read",
      ),
  );

  server.registerTool(
    "luma_create_event",
    {
      title: "Create Luma Event",
      description: "Create an event in the authorized Luma calendar.",
      inputSchema: {
        name: z.string().min(1),
        start_at: isoDateTime,
        timezone: z.string().min(1).describe("IANA timezone, for example America/New_York"),
        end_at: isoDateTime.optional(),
        description_md: z.string().optional(),
        visibility: z.enum(["public", "members-only", "private"]).optional(),
        meeting_url: z.string().url().optional(),
        max_capacity: z.number().int().optional(),
        slug: z.string().min(3).max(50).optional(),
        cover_url: z.string().url().optional(),
        tint_color: z.string().optional(),
        show_guest_list: z.boolean().optional(),
        can_register_for_multiple_tickets: z.boolean().optional(),
        reminders_disabled: z.boolean().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/create",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_event",
    {
      title: "Update Luma Event",
      description: "Update an existing Luma event.",
      inputSchema: {
        event_id: eventId,
        suppress_notifications: z.boolean().optional(),
        name: z.string().min(1).optional(),
        start_at: isoDateTime.optional(),
        timezone: z.string().min(1).optional(),
        end_at: isoDateTime.optional(),
        description_md: z.string().optional(),
        visibility: z.enum(["public", "members-only", "private"]).optional(),
        meeting_url: z.string().url().optional(),
        max_capacity: z.number().int().optional(),
        slug: z.string().min(3).max(50).optional(),
        cover_url: z.string().url().optional(),
        tint_color: z.string().optional(),
        show_guest_list: z.boolean().optional(),
        can_register_for_multiple_tickets: z.boolean().optional(),
        reminders_disabled: z.boolean().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/update",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_add_guests",
    {
      title: "Add Luma Guests",
      description: "Add guests to a Luma event with status Going. Optionally assign ticket details.",
      inputSchema: {
        event_id: eventId,
        guests: guestList,
        ticket: optionalJsonObject.nullable(),
        tickets: z.array(z.record(z.unknown())).optional().nullable(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/add-guests",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_send_invites",
    {
      title: "Send Luma Invites",
      description: "Invite guests to a Luma event by email, optionally with a short message.",
      inputSchema: {
        event_id: eventId,
        guests: guestList,
        message: z.string().max(200).optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/send-invites",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_guest_status",
    {
      title: "Update Luma Guest Status",
      description: "Update a guest registration status. Use Luma's accepted identifiers and status values.",
      inputSchema: {
        guest: z
          .object({
            event_id: eventId,
            id: z.string().min(1).optional(),
            email: z.string().email().optional(),
          })
          .passthrough(),
        status: z.enum(["declined", "approved"]),
        should_refund: z.boolean().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/update-guest-status",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_get_guest",
    {
      title: "Get Luma Guest",
      description: "Get detailed information for an event guest by guest ID, ticket key, guest key, or email.",
      inputSchema: {
        event_id: eventId,
        id: z.string().min(1),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          path: "/v1/event/get-guest",
          query: cleanQuery(args),
        },
        fetcher,
        extra,
        "luma.events.read",
      ),
  );

  server.registerTool(
    "luma_list_ticket_types",
    {
      title: "List Luma Ticket Types",
      description: "List all ticket types for a Luma event.",
      inputSchema: {
        event_id: eventId,
        include_hidden: z.boolean().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          path: "/v1/event/ticket-types/list",
          query: cleanQuery(args),
        },
        fetcher,
        extra,
        "luma.events.read",
      ),
  );

  server.registerTool(
    "luma_create_ticket_type",
    {
      title: "Create Luma Ticket Type",
      description: "Create a free or paid ticket type for a Luma event.",
      inputSchema: {
        event_id: eventId,
        name: z.string().min(1),
        type: z.enum(["free", "paid"]),
        require_approval: z.boolean().optional(),
        is_hidden: z.boolean().optional(),
        description: z.string().optional(),
        valid_start_at: z.string().optional(),
        valid_end_at: z.string().optional(),
        max_capacity: z.number().int().optional(),
        cents: z.number().int().nonnegative().optional(),
        currency: z.string().optional(),
        is_flexible: z.boolean().optional(),
        min_cents: z.number().int().nonnegative().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/ticket-types/create",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_ticket_type",
    {
      title: "Update Luma Ticket Type",
      description: "Update an existing Luma event ticket type.",
      inputSchema: {
        event_ticket_type_id: z.string().min(1).describe("Ticket type ID, usually starts with ett-"),
        name: z.string().min(1).optional(),
        require_approval: z.boolean().optional(),
        is_hidden: z.boolean().optional(),
        description: z.string().optional(),
        valid_start_at: z.string().optional(),
        valid_end_at: z.string().optional(),
        max_capacity: z.number().int().optional(),
        type: z.enum(["free", "paid"]).optional(),
        cents: z.number().int().nonnegative().optional(),
        currency: z.string().optional(),
        is_flexible: z.boolean().optional(),
        min_cents: z.number().int().nonnegative().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/ticket-types/update",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_create_coupon",
    {
      title: "Create Luma Coupon",
      description: "Create an event coupon for a Luma event.",
      inputSchema: {
        event_id: eventId,
        code: z.string().min(1).max(20),
        remaining_count: z.number().int().nonnegative().max(1_000_000).optional(),
        valid_start_at: isoDateTime.optional(),
        valid_end_at: isoDateTime.optional(),
        discount: z.record(z.unknown()),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/create-coupon",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_coupon",
    {
      title: "Update Luma Event Coupon",
      description: "Update event coupon availability dates or remaining count.",
      inputSchema: {
        event_id: eventId,
        code: z.string().min(1).max(20),
        remaining_count: z.number().int().optional(),
        valid_start_at: isoDateTime.optional(),
        valid_end_at: isoDateTime.optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/update-coupon",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_list_calendar_coupons",
    {
      title: "List Luma Calendar Coupons",
      description: "List all coupons created for the authorized Luma calendar.",
      inputSchema: {
        pagination_cursor: z.string().optional(),
        pagination_limit: z.number().int().positive().max(100).optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          path: "/v1/calendar/coupons",
          query: cleanQuery(args),
        },
        fetcher,
        extra,
        "luma.events.read",
      ),
  );

  server.registerTool(
    "luma_create_calendar_coupon",
    {
      title: "Create Luma Calendar Coupon",
      description: "Create a coupon that can apply to any event managed by the calendar.",
      inputSchema: {
        code: z.string().min(1).max(20),
        remaining_count: z.number().int().nonnegative().max(1_000_000).optional(),
        valid_start_at: isoDateTime.optional(),
        valid_end_at: isoDateTime.optional(),
        discount: z.record(z.unknown()),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/calendar/coupons/create",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_calendar_coupon",
    {
      title: "Update Luma Calendar Coupon",
      description: "Update calendar coupon availability dates or remaining count.",
      inputSchema: {
        code: z.string().min(1).max(20),
        remaining_count: z.number().int().optional(),
        valid_start_at: isoDateTime.optional(),
        valid_end_at: isoDateTime.optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/calendar/coupons/update",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_list_event_tags",
    {
      title: "List Luma Event Tags",
      description: "List event tags available on the authorized Luma calendar.",
    },
    async (extra) => callLuma({ path: "/v1/calendar/event-tags/list" }, fetcher, extra, "luma.events.read"),
  );

  server.registerTool(
    "luma_create_event_tag",
    {
      title: "Create Luma Event Tag",
      description: "Create an event tag on the authorized Luma calendar.",
      inputSchema: {
        name: z.string().min(1),
        color: z.enum(["cranberry", "barney", "red", "green", "blue", "purple", "yellow", "orange"]).nullable().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/calendar/event-tags/create",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_apply_event_tag",
    {
      title: "Apply Luma Event Tag",
      description: "Apply a tag to one or more events on the authorized Luma calendar.",
      inputSchema: {
        tag: z.string().min(1).describe("Tag ID, such as tag-123, or tag name"),
        event_ids: z.array(eventId).min(1),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/calendar/event-tags/apply",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_create_upload_url",
    {
      title: "Create Luma Image Upload URL",
      description: "Create a Luma CDN upload URL for cover images used in events.",
      inputSchema: {
        content_type: z.string().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/images/create-upload-url",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    
    "luma_create_host",
    {
      title: "Create Luma Event Host",
      description: "Add a manager or check-in host to a Luma event.",
      inputSchema: {
        event_id: eventId,
        email: z.string().email(),
        access_level: z.enum(["check-in", "manager"]).optional(),
        is_visible: z.boolean().optional(),
        name: z.string().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/hosts/create",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_update_host",
    {
      title: "Update Luma Event Host",
      description: "Update a host's permissions or visibility on a Luma event.",
      inputSchema: {
        event_id: eventId,
        email: z.string().email(),
        access_level: z.enum(["none", "check-in", "manager"]).optional(),
        is_visible: z.boolean().optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: "POST",
          path: "/v1/event/hosts/update",
          body: cleanObject(args),
        },
        fetcher,
        extra,
        "luma.events.write",
      ),
  );

  server.registerTool(
    "luma_request",
    {
      title: "Call Luma API",
      description:
        "Call any current Luma public API endpoint under /v1 using the authorized API key. Use this when a specific endpoint is not exposed as a named tool.",
      inputSchema: {
        method: z.enum(["GET", "POST"]),
        path: z.string().min(1).describe("Relative Luma API path, for example /v1/webhooks/list"),
        query: anyJsonObject.optional(),
        body: anyJsonObject.optional(),
      },
    },
    async (args, extra) =>
      callLuma(
        {
          method: args.method,
          path: validateLumaPath(args.path),
          query: args.query ? cleanQuery(args.query) : undefined,
          body: args.body ? cleanObject(args.body) : undefined,
        },
        fetcher,
        extra,
        args.method === "GET" ? "luma.events.read" : "luma.events.write",
      ),
  );

  return server;
}

async function callLuma(
  options: {
    path: string;
    query?: QueryParams;
    body?: JsonObject;
    method?: "GET" | "POST";
  },
  fetcher: Fetcher,
  extra: ToolExtra,
  requiredScope: LumaScope,
): Promise<CallToolResult> {
  try {
    if (!hasRequiredScope(extra.authInfo?.scopes, requiredScope)) {
      return makeToolError(new Error(`This tool requires OAuth scope ${requiredScope}.`));
    }

    const { lumaApiKey } = getLumaAuthProps({ props: extra.authInfo?.extra });
    const result = await lumaRequest(
      {
        apiKey: lumaApiKey,
        path: options.path,
        method: options.method,
        query: options.query,
        body: options.body,
      },
      fetcher,
    );

    return makeToolResult(result);
  } catch (error) {
    return makeToolError(error);
  }
}

function cleanObject<T extends JsonObject>(input: T): JsonObject {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function cleanQuery<T extends JsonObject>(input: T): QueryParams {
  return cleanObject(input) as QueryParams;
}
