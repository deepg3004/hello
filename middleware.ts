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
import { appHostPrefix, isPlatformOwnHost } from "@/lib/domains";
import { safeNext } from "@/lib/safe-redirect";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

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
  fetchedAt: number;
}
const HOST_LOOKUP_TTL_MS = 5 * 60 * 1000;
const hostLookupCache = new Map<string, CachedLookup>();

async function lookupHost(
  request: NextRequest,
  host: string,
): Promise<CachedLookup | null> {
  const cleaned = host.toLowerCase().split(":")[0]!;
  const cached = hostLookupCache.get(cleaned);
  if (cached && Date.now() - cached.fetchedAt < HOST_LOOKUP_TTL_MS) {
    return cached;
  }
  try {
    const u = request.nextUrl.clone();
    u.pathname = "/api/domains/lookup";
    u.search = `?host=${encodeURIComponent(cleaned)}`;
    const res = await fetch(u.toString(), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      kind?: "subdomain" | "custom_domain" | null;
      user_id?: string | null;
      username?: string | null;
    };
    const fresh: CachedLookup = {
      kind: body.kind ?? null,
      user_id: body.user_id ?? null,
      username: body.username ?? null,
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
        pathname.startsWith("/affiliate/") ||
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
      if (
        !isDashboard &&
        !isAdmin &&
        !isAuth &&
        !isSubdomainRoute &&
        !isMaintenance &&
        !isPolicy
      ) {
        const lookup = await lookupHost(request, rawHost);
        if (lookup?.user_id && lookup.username) {
          const url = request.nextUrl.clone();
          const segments = pathname.split("/").filter(Boolean);
          url.pathname = `/seller-host/${lookup.username}${segments.length ? "/" + segments.join("/") : ""}`;
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

  const supabase = createServerClient(
    url,
    anon,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // Refresh the session cookie on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

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
