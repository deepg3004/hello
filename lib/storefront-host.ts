// Server-only helper: compute the storefront base path for the current request.
// Returns "" on a seller subdomain / custom domain (the middleware rewrites bare
// paths), or "/seller-host/<username>" when the storefront is viewed directly on
// the platform host (preview / pre-custom-domain sharing) so internal links
// don't 404 against the platform root.

import { headers } from "next/headers";

import { isPlatformOwnHost } from "@/lib/domains";

export function storefrontBasePath(username: string): string {
  const host = (headers().get("host") ?? "").split(":")[0].toLowerCase();
  return host && isPlatformOwnHost(host) ? `/seller-host/${username}` : "";
}
