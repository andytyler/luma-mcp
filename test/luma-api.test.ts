import { describe, expect, test } from "bun:test";
import {
  buildLumaUrl,
  type Fetcher,
  formatLumaResult,
  lumaRequest,
  validateLumaApiKey,
  validateLumaPath,
} from "../src/luma-api";

describe("Luma API helpers", () => {
  test("buildLumaUrl omits empty values and repeats array query params", () => {
    const url = buildLumaUrl("/v1/calendar/list-events", {
      after: "2026-05-18T10:00:00.000Z",
      before: undefined,
      platforms: ["luma", "external"],
      pagination_limit: 10,
      status: null,
    });

    expect(url.toString()).toBe(
      "https://public-api.luma.com/v1/calendar/list-events?after=2026-05-18T10%3A00%3A00.000Z&platforms=luma&platforms=external&pagination_limit=10",
    );
  });

  test("lumaRequest sends the per-user API key header", async () => {
    const calls: Request[] = [];
    const fetcher: Fetcher = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      return Response.json({ ok: true });
    };

    await lumaRequest(
      {
        apiKey: "luma-secret",
        path: "/v1/event/get",
        query: { event_id: "evt-123" },
      },
      fetcher,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("x-luma-api-key")).toBe("luma-secret");
    expect(calls[0].url).toBe(
      "https://public-api.luma.com/v1/event/get?event_id=evt-123",
    );
  });

  test("lumaRequest reports upstream error details without exposing the API key", async () => {
    const fetcher: Fetcher = async () =>
      Response.json({ message: "No access" }, { status: 403 });

    await expect(
      lumaRequest(
        {
          apiKey: "very-secret-key",
          path: "/v1/event/get",
          query: { event_id: "evt-123" },
        },
        fetcher,
      ),
    ).rejects.toThrow("Luma API request failed with 403: {\"message\":\"No access\"}");
  });

  test("validateLumaApiKey checks a low-cost calendar endpoint", async () => {
    const calls: Request[] = [];
    const fetcher: Fetcher = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      return Response.json({ entries: [] });
    };

    const result = await validateLumaApiKey("calendar-key", fetcher);

    expect(result.ok).toBe(true);
    expect(calls[0].url).toBe(
      "https://public-api.luma.com/v1/calendar/list-events?pagination_limit=1",
    );
    expect(calls[0].headers.get("x-luma-api-key")).toBe("calendar-key");
  });

  test("validateLumaApiKey falls back to organization endpoint for organization keys", async () => {
    const calls: Request[] = [];
    const fetcher: Fetcher = async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      if (calls.length === 1) {
        return Response.json({ message: "Calendar endpoint unavailable" }, { status: 403 });
      }
      return Response.json({ entries: [] });
    };

    const result = await validateLumaApiKey("org-key", fetcher);

    expect(result).toEqual({ ok: true, keyType: "organization" });
    expect(calls.map((call) => call.url)).toEqual([
      "https://public-api.luma.com/v1/calendar/list-events?pagination_limit=1",
      "https://public-api.luma.com/v1/organizations/calendars/list?pagination_limit=1",
    ]);
  });

  test("validateLumaPath only allows relative v1 API paths", () => {
    expect(validateLumaPath("/v1/event/update")).toBe("/v1/event/update");
    expect(() => validateLumaPath("https://evil.example/v1/event/update")).toThrow(
      "Luma path must be a relative /v1/ path",
    );
    expect(() => validateLumaPath("/v2/event/update")).toThrow(
      "Luma path must be a relative /v1/ path",
    );
    expect(() => validateLumaPath("/v1/../secrets")).toThrow(
      "Luma path cannot contain path traversal",
    );
  });

  test("formatLumaResult pretty prints JSON responses for MCP text content", () => {
    expect(formatLumaResult({ event: { name: "Launch" } })).toBe(
      '{\n  "event": {\n    "name": "Launch"\n  }\n}',
    );
  });
});
