import { describe, expect, test } from "bun:test";
import {
  getLumaAuthProps,
  hasRequiredScope,
  LUMA_TOOL_NAMES,
  makeToolResult,
} from "../src/mcp-helpers";
import { makeAuthInfo } from "../src/mcp-http";

describe("MCP tool helpers", () => {
  test("LUMA_TOOL_NAMES exposes the primary calendar and event tools", () => {
    expect(LUMA_TOOL_NAMES).toEqual([
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
    ]);
  });

  test("getLumaAuthProps rejects missing encrypted OAuth props", () => {
    expect(() => getLumaAuthProps({ props: {} })).toThrow(
      "This MCP request is missing Luma credentials",
    );
  });

  test("getLumaAuthProps returns the Luma API key from OAuth props", () => {
    expect(
      getLumaAuthProps({
        props: {
          lumaApiKey: "luma-secret",
          lumaApiKeyHash: "abc123",
          grantedAt: "2026-05-18T09:00:00.000Z",
        },
      }),
    ).toEqual({
      lumaApiKey: "luma-secret",
      lumaApiKeyHash: "abc123",
      grantedAt: "2026-05-18T09:00:00.000Z",
    });
  });

  test("makeToolResult returns MCP text content", () => {
    expect(makeToolResult({ ok: true })).toEqual({
      content: [{ type: "text", text: '{\n  "ok": true\n}' }],
    });
  });

  test("makeAuthInfo propagates OAuth scopes from encrypted props", () => {
    expect(
      makeAuthInfo({
        scopes: ["luma.events.read"],
        lumaApiKey: "secret",
      }),
    ).toMatchObject({
      scopes: ["luma.events.read"],
      extra: {
        lumaApiKey: "secret",
      },
    });
  });

  test("hasRequiredScope distinguishes read-only from write grants", () => {
    expect(hasRequiredScope(["luma.events.read"], "luma.events.read")).toBe(true);
    expect(hasRequiredScope(["luma.events.read"], "luma.events.write")).toBe(false);
    expect(hasRequiredScope(["luma.events.write"], "luma.events.write")).toBe(true);
  });
});
