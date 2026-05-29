import { OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { LUMA_OAUTH_SCOPES } from "./auth";
import { handleMcpRequest } from "./mcp-http";
import { handleAuthorize, type AuthEnv } from "./worker-auth";

export type Env = AuthEnv & {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
};

const mcpApiHandler = {
  async fetch(request, env, ctx) {
    const props = (ctx as ExecutionContext & { props?: Record<string, unknown> }).props;
    return handleMcpRequest(request, props);
  },
} satisfies ExportedHandler<Env> & {
  fetch: NonNullable<ExportedHandler<Env>["fetch"]>;
};

const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/authorize") {
      return handleAuthorize(request, env);
    }

    if (url.pathname === "/") {
      return homePage(url.origin);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env> & {
  fetch: NonNullable<ExportedHandler<Env>["fetch"]>;
};

const oauthProvider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler,
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: [...LUMA_OAUTH_SCOPES],
  allowPlainPKCE: false,
  accessTokenTTL: 3600,
  refreshTokenTTL: 60 * 60 * 24 * 30,
  resourceMetadata: {
    resource_name: "Luma MCP",
    scopes_supported: [...LUMA_OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
  },
});

export default {
  fetch(request, env, ctx) {
    return oauthProvider.fetch(request, env, ctx);
  },

  scheduled(_controller, env, ctx) {
    ctx.waitUntil(oauthProvider.purgeExpiredData(env, { batchSize: 50 }));
  },
} satisfies ExportedHandler<Env>;

function homePage(origin: string): Response {
  const body = `Luma MCP

Remote MCP endpoint:
${origin}/mcp

OAuth endpoints:
${origin}/authorize
${origin}/oauth/token
${origin}/oauth/register

Use this server from MCP clients that support remote MCP with OAuth. During authorization, paste a Luma calendar API key from a Luma Plus calendar.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
