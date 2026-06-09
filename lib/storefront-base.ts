// Pure helper (client-safe) for prefixing internal storefront links with the
// host base path. See lib/storefront-host.ts for computing the base on the
// server.
//
// On a seller subdomain / custom domain the middleware rewrites bare paths
// (base = ""), so "/store" works as-is. When the storefront is viewed directly
// on the platform host at /seller-host/<username>, internal links must carry
// that prefix or they 404 against the platform root.
export function withStorefrontBase(
  base: string,
  url: string | undefined | null,
): string {
  if (!url) return url ?? "";
  if (!base) return url;
  if (!url.startsWith("/")) return url; // external / anchor / relative — leave
  if (url.startsWith("/seller-host/")) return url; // already prefixed
  if (url === "/") return base; // storefront home
  return `${base}${url}`;
}
