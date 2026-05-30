// GET /api/platform/maintenance
//
// Returns {on: boolean}. Middleware polls this once a minute to decide
// whether to short-circuit public requests to /maintenance.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    const on = data?.value === "true";
    return NextResponse.json(
      { ok: true, on },
      { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
    );
  } catch {
    return NextResponse.json(
      { ok: true, on: false },
      { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
    );
  }
}
