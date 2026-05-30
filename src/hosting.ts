export type HostingEnv = {
  [key: string]: string | undefined;
  MCP_BASE_URL?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
};

export function publicBaseUrl(
  request: Request,
  env: HostingEnv = process.env,
): URL {
  if (env.MCP_BASE_URL) {
    return new URL(env.MCP_BASE_URL);
  }

  if (env.RAILWAY_PUBLIC_DOMAIN) {
    return new URL(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const proto = forwardedProto ?? requestUrl.protocol.replace(":", "");
  return new URL(`${proto}://${host}`);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) {
    return {};
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      request.headers.get("access-control-request-headers") ??
      "authorization, content-type, mcp-protocol-version",
    "access-control-expose-headers": "www-authenticate, mcp-session-id",
    vary: "Origin, Access-Control-Request-Headers",
  };
}
