import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLumaMcpServer } from "./mcp";

export async function handleMcpRequest(
  request: Request,
  props: Record<string, unknown> | undefined,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createLumaMcpServer();
  await server.connect(transport);

  return transport.handleRequest(request, {
    authInfo: makeAuthInfo(props),
  });
}

export function makeAuthInfo(props: Record<string, unknown> | undefined): AuthInfo {
  return {
    token: "managed-by-workers-oauth-provider",
    clientId: "registered-mcp-client",
    scopes: extractScopes(props),
    extra: props ?? {},
  };
}

function extractScopes(props: Record<string, unknown> | undefined): string[] {
  if (!Array.isArray(props?.scopes)) {
    return [];
  }

  return props.scopes.filter((scope): scope is string => typeof scope === "string");
}
