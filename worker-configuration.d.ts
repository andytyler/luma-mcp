import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

declare global {
  namespace Cloudflare {
    interface Env {
      OAUTH_KV: KVNamespace;
      OAUTH_PROVIDER: OAuthHelpers;
    }
  }
}
