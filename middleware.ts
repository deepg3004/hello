import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_TTL_DAYS,
  VARIANT_COOKIE_TTL_DAYS,
  allocateVariant,
  newVisitorId,
  variantCookieName,
} from "@/lib/ab";
import { appHostPrefix, isPlatformOwnHost, extractSubdomain, authCookieDomain } from "@/lib/domains";
import { safeNext } from "@/lib/safe-redirect";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

// Public auth fully disabled (user request): /login and /signup are removed from
// the UI and blocked at the route level — both redirect to "/". Flip to false to
// restore browser sign-in/sign-up. NOTE: while true, NOBODY can sign in via the
// browser (no bypass), by design.
const BLOCK_PUBLIC_AUTH = false;
const BLOCKED_AUTH_PATHS = ["/login", "/signup"];

// ── A/B variant routing for public /p/[slug] ───────────────────────────────
// 60-second module-level cache so a hot page doesn't fetch from /api/ab/config
// on every request. Each Edge worker keeps its own copy.
interface CachedConfig {
  running: boolean;
  traffic_split: number | null;
  has_variant_b: boolean;
  fetchedAt: number;
}
const EXP_CACHE_TTL_MS = 60_000;
const expCache = new Map<string, CachedConfig>();

async function loadExpConfig(
  request: NextRequest,
  slug: string,
): Promise<CachedConfig | null> {
  const cached = expCache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < EXP_CACHE_TTL_MS) {
    return cached;
  }
  try {
    const u = request.nextUrl.clone();
    u.pathname = "/api/ab/config";
    u.search = `?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(u.toString(), {
      // Edge fetch — keep it minimal and cache-friendly.
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      running?: boolean;
      traffic_split?: number | null;
      has_variant_b?: boolean;
    };
    const fresh: CachedConfig = {
      running: !!body.running,
      traffic_split: body.traffic_split ?? null,
      has_variant_b: !!body.has_variant_b,
      fetchedAt: Date.now(),
    };
    expCache.set(slug, fresh);
    return fresh;
  } catch {
    return null;
  }
}

function maybeRouteAB(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse | null> {
  // Only act on /p/[slug] and only on the bare slug (not /p/[slug]/oto etc.).
  const match = pathname.match(/^\/p\/([^\/]+)\/?$/);
  if (!match) return Promise.resolve(null);
  const slug = match[1]!;
  return (async () => {
    const config = await loadExpConfig(request, slug);
    if (
      !config ||
      !config.running ||
      !config.has_variant_b ||
      config.traffic_split == null
    ) {
      return null;
    }

    // 1. visitor id cookie
    let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
    let mintedVisitor = false;
    if (!visitorId) {
      visitorId = newVisitorId();
      mintedVisitor = true;
    }

    // 2. variant cookie (sticky for the duration)
    const varCookie = variantCookieName(slug);
    let variant = request.cookies.get(varCookie)?.value as
      | "A"
      | "B"
      | undefined;
    let mintedVariant = false;
    if (variant !== "A" && variant !== "B") {
      variant = allocateVariant({
        visitorId,
        slug,
        trafficSplit: config.traffic_split,
      });
      mintedVariant = true;
    }

    // 3. rewrite for B, pass through for A
    const url = request.nextUrl.clone();
    let response: NextResponse;
    if (variant === "B") {
      url.pathname = `/p-variant/${slug}`;
      response = NextResponse.rewrite(url);
    } else {
      response = NextResponse.next();
    }

    // 4. set cookies so the assignment + visitor id stick for next time
    if (mintedVisitor) {
      response.cookies.set({
        name: VISITOR_COOKIE,
        value: visitorId,
        maxAge: VISITOR_COOKIE_TTL_DAYS * 86_400,
        path: "/",
        sameSite: "lax",
      });
    }
    if (mintedVariant) {
      response.cookies.set({
        name: varCookie,
        value: variant,
        maxAge: VARIANT_COOKIE_TTL_DAYS * 86_400,
        path: "/",
        sameSite: "lax",
      });
    }
    return response;
  })();
}

// ── Host → seller routing (subdomain + custom domain) ──────────────────────
interface CachedLookup {
  kind: "subdomain" | "custom_domain" | null;
  user_id: string | null;
  username: string | null;
  redirect_to_custom: string | null;
  fetchedAt: number;
}
// The /api/domains/lookup route is itself Redis-backed (Node runtime, shared
// across all PM2 workers) — that's the single source of truth. This in-process
// Map is only a tiny per-worker hop-saver; keep its TTL SHORT (30s) so a worker
// can't serve a stale subdomain/custom-domain/redirect decision for long after
// a change (middleware runs in the Edge runtime, which can't use ioredis
// directly — hence caching on the API side, not here).
const HOST_LOOKUP_TTL_MS = 30 * 1000;
const hostLookupCache = new Map<string, CachedLookup>();

async function lookupHost(host: string): Promise<CachedLookup | null> {
  const cleaned = host.toLowerCase().split(":")[0]!;
  const cached = hostLookupCache.get(cleaned);
  if (cached && Date.now() - cached.fetchedAt < HOST_LOOKUP_TTL_MS) {
    return cached;
  }
  try {
    // Resolve against the LOCAL app, never the public hostname. Reconstructing
    // the public URL (https://<host>/...) makes the server fetch ITSELF back
    // out through DNS/nginx/TLS — a flaky self-loop that was returning null in
    // prod, breaking custom-domain routing AND the subdomain→custom redirect.
    // The endpoint keys off ?host=, so this internal call's Host header is
    // irrelevant.
    const base = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
    const res = await fetch(
      `${base}/api/domains/lookup?host=${encodeURIComponent(cleaned)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      kind?: "subdomain" | "custom_domain" | null;
      user_id?: string | null;
      username?: string | null;
      redirect_to_custom?: string | null;
    };
    const fresh: CachedLookup = {
      kind: body.kind ?? null,
      user_id: body.user_id ?? null,
      username: body.username ?? null,
      redirect_to_custom: body.redirect_to_custom ?? null,
      fetchedAt: Date.now(),
    };
    hostLookupCache.set(cleaned, fresh);
    return fresh;
  } catch {
    return null;
  }
}

// Maintenance mode used to live here (HTTP fetch from middleware to
// /api/platform/maintenance) but the round-trip caused 502s under load
// and Next 14 doesn't honour `status` on NextResponse.rewrite. The gate
// now lives directly in the (public) + (dashboard) layouts, which read
// platform_settings via the admin client — no HTTP loop, admins bypass
// via a Supabase-session lookup.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Policy pages must resolve on EVERY host (apex, app.*, and seller
  // subdomains / custom domains) — payment-gateway reviewers visit a seller's
  // branded page and follow these links. Without this, the host-routing
  // rewrites below would send /privacy → /seller-host/<user>/privacy (404).
  const isPolicy =
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/refund";

  // Allow public APIs and assets through untouched.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ── App-host path rewrites: app.invoxai.io → /dashboard/...,
  //    admin.invoxai.io → /admin/... so URLs stay clean.
  try {
    const rawHost = request.headers.get("host") ?? "";
    const prefix = appHostPrefix(rawHost);
    if (prefix) {
      const isAlready = pathname === prefix || pathname.startsWith(`${prefix}/`);
      const isAuth =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/verify-phone") ||
        pathname.startsWith("/auth/");
      const isPublic =
        pathname.startsWith("/p/") ||
        pathname.startsWith("/ln/") ||
        pathname.startsWith("/tg/") ||
        pathname.startsWith("/ld/") ||
        pathname.startsWith("/order/") ||
        pathname.startsWith("/course/") ||
        pathname.startsWith("/unlock/") ||
        pathname.startsWith("/download/") ||
        pathname.startsWith("/book/") ||
        pathname.startsWith("/event/") ||
        pathname.startsWith("/affiliate/") ||
        pathname.startsWith("/account") ||
        pathname.startsWith("/team/") ||
        pathname === "/maintenance" ||
        pathname.startsWith("/seller-host/") ||
        pathname.startsWith("/preview/") ||
        isPolicy;
      if (!isAlready && !isAuth && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`;
        return NextResponse.rewrite(url);
      }
    }
  } catch {
    /* non-fatal — fall through */
  }

  // ── Host routing: rewrite *.invoxai.io subdomains + custom domains
  //    to /seller-host/[username]/[...slug] so the browser keeps the
  //    seller's branded URL while we render their page server-side.
  try {
    const rawHost = request.headers.get("host") ?? "";
    if (rawHost && !isPlatformOwnHost(rawHost)) {
      const isDashboard =
        pathname === "/dashboard" || pathname.startsWith("/dashboard/");
      const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
      const isAuth =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/verify-phone") ||
        pathname.startsWith("/auth/");
      const isSubdomainRoute = pathname.startsWith("/seller-host/");
      const isMaintenance = pathname === "/maintenance";
      const isCourse = pathname.startsWith("/course/");
      // Public, host-agnostic routes (slugs/ids are globally unique) — let these
      // resolve directly on a seller's subdomain/custom domain too, so the SAME
      // link works on the branded host AND the main domain. Bare slugs (no
      // prefix) still fall through to the seller-host store/page rewrite below.
      const isPublicPrefixed =
        pathname.startsWith("/p/") ||
        pathname.startsWith("/ln/") ||
        pathname.startsWith("/tg/") ||
        pathname.startsWith("/ld/") ||
        pathname.startsWith("/order/") ||
        pathname.startsWith("/affiliate/") ||
        pathname.startsWith("/account") ||
        pathname.startsWith("/team/") ||
        pathname.startsWith("/unlock/") ||
        pathname.startsWith("/download/") ||
        pathname.startsWith("/book/") ||
        pathname.startsWith("/event/") ||
        pathname.startsWith("/preview/");
      if (
        !isDashboard &&
        !isAdmin &&
        !isAuth &&
        !isSubdomainRoute &&
        !isMaintenance &&
        !isPolicy &&
        !isCourse &&
        !isPublicPrefixed
      ) {
        // For *.invoxai.io subdomains, resolve the seller handle LOCALLY from the
        // hostname — no network call. This is critical: a runtime fetch to
        // /api/domains/lookup can be cold/slow right after a deploy, and if it
        // returned null the request fell through to the marketing landing page
        // (which is cacheable), so browsers cached the wrong page for the
        // subdomain. Local resolution can never do that. Custom domains (not
        // *.invoxai.io) still use the API lookup.
        let username = extractSubdomain(rawHost);
        if (username) {
          // Seller may have opted to make their custom domain canonical — if so
          // redirect the whole subdomain there (path + query preserved). Cached
          // lookup; if it's cold/unavailable we just fall through to the normal
          // local rewrite below, so this can never strand the subdomain.
          const lookup = await lookupHost(rawHost);
          if (lookup?.redirect_to_custom) {
            const target = request.nextUrl.clone();
            target.protocol = "https:";
            target.host = lookup.redirect_to_custom;
            target.port = "";
            return NextResponse.redirect(target, 308);
          }
        } else {
          const lookup = await lookupHost(rawHost);
          username = lookup?.user_id ? lookup.username : null;
        }
        if (username) {
          const url = request.nextUrl.clone();
          const segments = pathname.split("/").filter(Boolean);
          url.pathname = `/seller-host/${username}${segments.length ? "/" + segments.join("/") : ""}`;
          return NextResponse.rewrite(url);
        }
      }
    }
  } catch {
    /* non-fatal — fall through */
  }

  // Maintenance mode handled in layouts; see app/(public)/layout.tsx and
  // app/(dashboard)/layout.tsx.

  // Public payment / landing page — possibly route through A/B.
  if (pathname.startsWith("/p/")) {
    const abResponse = await maybeRouteAB(request, pathname);
    if (abResponse) return abResponse;
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not yet configured (fresh scaffold) — let everything through so
  // the app still boots in development before keys are filled in.
  if (!url || !anon) {
    return response;
  }

  // Cross-subdomain session: scope auth cookies to .invoxai.io so the apex,
  // app.* and admin.* share one login (host-only on localhost / custom domains).
  const cookieDomain = authCookieDomain(request.headers.get("host"));
  // @supabase/ssr v0.5 getAll/setAll. setAll writes ALL refreshed cookies in a
  // SINGLE pass and recreates the response ONCE — the old per-cookie set()
  // rebuilt the response on every call, dropping earlier Set-Cookie headers for
  // the chunked session cookie (…auth-token.0/.1). That sent the browser a
  // corrupted/partial session → every later request looked expired → a storm of
  // concurrent refreshes racing to rotate the same token (refresh_token_already_used)
  // that exhausted the GoTrue rate limit and 429'd real logins.
  const supabase = createServerClient(
    url,
    anon,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: request.headers } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set({
              name,
              value,
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            });
          }
        },
      },
    },
  );

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Public auth disabled — send /login and /signup to the home page instead of
  // rendering the auth pages (defence-in-depth alongside removing the buttons).
  if (BLOCK_PUBLIC_AUTH && BLOCKED_AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  // Speculative App-Router prefetches should never rotate the session: a
  // dashboard full of <Link>s prefetches many routes at once, and each used to
  // fire its own getUser()/refresh -> a burst of concurrent refreshes racing to
  // rotate the same token. The real navigation re-runs middleware, and every
  // protected page also has its own server-side guard (requirePageActor), so
  // skipping the refresh here cannot leak protected content.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true;

  // Only touch Supabase auth when the route needs it for a redirect decision
  // (protected pages, or auth pages that bounce a logged-in user to /dashboard).
  // getUser() forces a token refresh; under the broad matcher that previously
  // meant EVERY public page + every /api/* call (which all do their own auth)
  // refreshed on each request. At token expiry a burst of concurrent requests
  // then raced to rotate the SAME refresh token -> `refresh_token_already_used`
  // storms that exhaust the GoTrue auth rate limit and 429 real logins.
  if (isPrefetch || (!isProtected && !isAuthRoute)) {
    return response;
  }

  // Refresh the session cookie + resolve the user for the redirect gates below.
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Self-heal a dead/rotated session: a stale or already-used refresh token
  // returns an auth error while a session cookie is still present, so every
  // subsequent request keeps firing a doomed refresh. Clear the Supabase auth
  // cookies once so the user lands on a clean login. Scoped to refresh-token
  // errors only — a transient GoTrue outage must NOT log everyone out.
  if (!user && authError) {
    const code = (authError as { code?: string }).code ?? "";
    const isRefreshError =
      code.includes("refresh_token") || /refresh token/i.test(authError.message);
    if (isRefreshError) {
      for (const c of request.cookies.getAll()) {
        if (/^sb-.*-auth-token/.test(c.name)) {
          response.cookies.set({
            name: c.name,
            value: "",
            maxAge: 0,
            path: "/",
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          });
        }
      }
    }
  }

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    // Sanitised — middleware-built `pathname` is always a relative path on
    // our own host, but defence-in-depth means the login form / callback
    // can trust this value without re-checking.
    redirect.searchParams.set("next", safeNext(pathname));
    return NextResponse.redirect(redirect);
  }

  if (user && isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every route except static files and image optimizer.
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
