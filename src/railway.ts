import { bearerError, jsonResponse, RailwayOAuthServer } from "./railway-oauth";
import { handleMcpRequest } from "./mcp-http";
import { corsHeaders, publicBaseUrl } from "./hosting";

const DEFAULT_STORAGE_PATH = "./data/luma-mcp.sqlite";
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;

const appSecret = process.env.APP_SECRET;
if (!appSecret) {
  throw new Error("APP_SECRET is required. Set it to a random 32+ character value.");
}

const oauth = new RailwayOAuthServer({
  storagePath:
    process.env.MCP_STORAGE_PATH ??
    (process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/luma-mcp.sqlite`
      : DEFAULT_STORAGE_PATH),
  appSecret,
});

oauth.purgeExpired();
setInterval(() => oauth.purgeExpired(), 60 * 60 * 1000).unref?.();

const server = Bun.serve({
  hostname: process.env.HOST ?? DEFAULT_HOST,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  async fetch(request) {
    try {
      return await route(request);
    } catch (error) {
      console.error(error);
      return jsonResponse({ ok: false, error: "Internal server error" }, 500);
    }
  },
});

console.log(`Luma MCP listening on ${server.hostname}:${server.port}`);

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = publicBaseUrl(request);
  const cors = corsHeaders(request);

  if (request.method === "OPTIONS" && isCorsRoute(url.pathname)) {
    return new Response(null, {
      status: 204,
      headers: cors,
    });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse(oauth.health(), 200, cors);
  }

  if (request.method === "GET" && url.pathname === "/") {
    return homePage(baseUrl);
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/.well-known/oauth-authorization-server" ||
      url.pathname === "/.well-known/openid-configuration")
  ) {
    return jsonResponse(oauth.metadata(baseUrl), 200, cors);
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp")
  ) {
    return jsonResponse(oauth.protectedResourceMetadata(baseUrl), 200, cors);
  }

  if (url.pathname === "/authorize" && (request.method === "GET" || request.method === "POST")) {
    return oauth.authorize(request, baseUrl);
  }

  if (url.pathname === "/oauth/register" && request.method === "POST") {
    return withHeaders(await oauth.registerClient(request), cors);
  }

  if ((url.pathname === "/oauth/token" || url.pathname === "/token") && request.method === "POST") {
    return withHeaders(await oauth.token(request), cors);
  }

  if (url.pathname === "/oauth/revoke" && request.method === "POST") {
    return withHeaders(await oauth.revoke(request), cors);
  }

  if (url.pathname === "/mcp") {
    const authInfo = await authInfoFromRequest(request, new URL("/mcp", baseUrl));
    if (!authInfo.ok) {
      return withHeaders(bearerError(baseUrl, authInfo.message), cors);
    }
    return withHeaders(await handleMcpRequest(request, authInfo.value.extra), cors);
  }

  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function isCorsRoute(pathname: string): boolean {
  return (
    pathname === "/mcp" ||
    pathname === "/oauth/register" ||
    pathname === "/oauth/token" ||
    pathname === "/token" ||
    pathname === "/oauth/revoke" ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/openid-configuration" ||
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname === "/.well-known/oauth-protected-resource/mcp"
  );
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  if (Object.keys(headers).length === 0) {
    return response;
  }

  const nextHeaders = new Headers(response.headers);
  for (const [name, value] of Object.entries(headers)) {
    nextHeaders.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

async function authInfoFromRequest(
  request: Request,
  expectedResource: URL,
): Promise<
  | { ok: true; value: Awaited<ReturnType<RailwayOAuthServer["verifyAccessToken"]>> }
  | { ok: false; message: string }
> {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, message: "Missing bearer token." };
  }

  try {
    return { ok: true, value: await oauth.verifyAccessToken(match[1], expectedResource) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid bearer token.",
    };
  }
}

function homePage(baseUrl: URL): Response {
  const body = `Luma MCP

Remote MCP endpoint:
${new URL("/mcp", baseUrl).href}

OAuth discovery:
${new URL("/.well-known/oauth-protected-resource/mcp", baseUrl).href}
${new URL("/.well-known/oauth-authorization-server", baseUrl).href}

Health:
${new URL("/health", baseUrl).href}

Use this server from MCP clients that support remote MCP with OAuth. During authorization, paste a Luma calendar or organization API key.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
