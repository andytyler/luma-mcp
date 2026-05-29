import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatLumaResult } from "./luma-api";

export const LUMA_TOOL_NAMES = [
  "luma_get_calendar",
  "luma_list_events",
  "luma_get_event",
  "luma_create_event",
  "luma_update_event",
  "luma_add_guests",
  "luma_send_invites",
  "luma_update_guest_status",
  "luma_get_guest",
  "luma_list_ticket_types",
  "luma_create_ticket_type",
  "luma_update_ticket_type",
  "luma_create_coupon",
  "luma_update_coupon",
  "luma_list_calendar_coupons",
  "luma_create_calendar_coupon",
  "luma_update_calendar_coupon",
  "luma_list_event_tags",
  "luma_create_event_tag",
  "luma_apply_event_tag",
  "luma_create_upload_url",
  "luma_create_host",
  "luma_update_host",
  "luma_request",
] as const;

export type LumaScope = "luma.events.read" | "luma.events.write";

export type LumaAuthProps = {
  lumaApiKey: string;
  lumaApiKeyHash: string;
  grantedAt: string;
  scopes?: string[];
};

export type AuthContextLike = {
  props?: Record<string, unknown>;
};

export function getLumaAuthProps(context: AuthContextLike | undefined): LumaAuthProps {
  const props = context?.props;

  if (
    typeof props?.lumaApiKey !== "string" ||
    typeof props.lumaApiKeyHash !== "string" ||
    typeof props.grantedAt !== "string"
  ) {
    throw new Error(
      "This MCP request is missing Luma credentials. Reconnect the MCP server and authorize with a Luma API key.",
    );
  }

  return {
    lumaApiKey: props.lumaApiKey,
    lumaApiKeyHash: props.lumaApiKeyHash,
    grantedAt: props.grantedAt,
    scopes: Array.isArray(props.scopes)
      ? props.scopes.filter((scope): scope is string => typeof scope === "string")
      : undefined,
  };
}

export function hasRequiredScope(
  grantedScopes: readonly string[] | undefined,
  requiredScope: LumaScope,
): boolean {
  return grantedScopes?.includes(requiredScope) ?? false;
}

export function makeToolResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: formatLumaResult(value) }],
  };
}

export function makeToolError(error: unknown): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : "Unknown Luma MCP error",
      },
    ],
  };
}
