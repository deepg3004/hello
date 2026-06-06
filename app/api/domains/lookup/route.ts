// GET /api/domains/lookup?host=foo.invoxai.io
//
// Returns the seller (subdomain or custom-domain owner) behind a hostname,
// so middleware can decide whether to rewrite the request.
//
// Cached:
//   - server-side in Redis for 5 minutes (key = host_lookup:<host>)
//   - response carries Cache-Control: s-maxage=300 so any front cache helps too
//
// Response shape:
//   { ok: true, subdomain | custom_domain | null, user_id, username }

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";
import {
  HOST_LOOKUP_TTL_SECONDS,
  extractSubdomain,
  hostLookupCacheKey,
  isPlatformOwnHost,
  platformRootDomain,
} from "@/lib/domains";

export const runtime = "nodejs";

interface LookupBody {
  ok: true;
  /** "subdomain" | "custom_domain" | null */
  kind: "subdomain" | "custom_domain" | null;
  user_id: string | null;
  username: string | null;
  /** The seller's verified custom domain to redirect this subdomain to, when
   *  the seller has turned on subdomain→custom redirect. null otherwise. */
  redirect_to_custom?: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = url.searchParams.get("host");
  if (!host) {
    return NextResponse.json(
      { ok: false, error: "host required" },
      { status: 400 },
    );
  }
  const cleanedHost = host.toLowerCase().split(":")[0]!;

  if (isPlatformOwnHost(cleanedHost)) {
    return jsonCached({ ok: true, kind: null, user_id: null, username: null });
  }

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(hostLookupCacheKey(cleanedHost));
      if (raw) {
        return jsonCached(JSON.parse(raw) as LookupBody);
      }
    } catch {
      /* non-fatal */
    }
  }

  const admin = createAdminClient();

  // Try subdomain first.
  const sub = extractSubdomain(cleanedHost);
  let body: LookupBody;
  if (sub) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select(
        "id, subdomain, custom_domain, custom_domain_verified_at, subdomain_redirect_to_custom",
      )
      .eq("subdomain", sub)
      .maybeSingle();
    if (profile?.subdomain) {
      // Surface a redirect target only when the seller opted in AND their
      // custom domain is actually verified — otherwise we'd redirect to a
      // dead host.
      const redirectTo =
        profile.subdomain_redirect_to_custom &&
        profile.custom_domain &&
        profile.custom_domain_verified_at
          ? (profile.custom_domain as string)
          : null;
      body = {
        ok: true,
        kind: "subdomain",
        user_id: profile.id as string,
        username: profile.subdomain,
        redirect_to_custom: redirectTo,
      };
    } else {
      body = { ok: true, kind: null, user_id: null, username: null };
    }
  } else {
    // Not under our apex — check the custom_domain column.
    if (cleanedHost.endsWith(`.${platformRootDomain()}`)) {
      // A label under our apex that isn't a claimed subdomain — no rewrite.
      body = { ok: true, kind: null, user_id: null, username: null };
    } else {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("id, subdomain, custom_domain, custom_domain_verified_at")
        .eq("custom_domain", cleanedHost)
        .maybeSingle();
      if (profile?.custom_domain && profile.custom_domain_verified_at) {
        body = {
          ok: true,
          kind: "custom_domain",
          user_id: profile.id as string,
          username: (profile.subdomain as string | null) ?? null,
        };
      } else {
        body = { ok: true, kind: null, user_id: null, username: null };
      }
    }
  }

  if (redis) {
    try {
      await redis.set(
        hostLookupCacheKey(cleanedHost),
        JSON.stringify(body),
        "EX",
        HOST_LOOKUP_TTL_SECONDS,
      );
    } catch {
      /* non-fatal */
    }
  }
  return jsonCached(body);
}

function jsonCached(body: LookupBody): NextResponse {
  return NextResponse.json(body, {
    headers: { "cache-control": "public, max-age=300, s-maxage=300" },
  });
}
