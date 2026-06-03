import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The bell reads/writes through this route (server-side, authed via the session
// cookie) instead of the browser Supabase client. This guarantees the feed
// renders even if a browser-side RLS/session quirk would otherwise return an
// empty list. Reads are scoped to the authenticated user's own rows.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data }, { count }] = await Promise.all([
    admin
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return NextResponse.json({ items: data ?? [], unread: count ?? 0 });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    all?: boolean;
  };
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Always scope to the caller's own rows so one user can't mark another's.
  let query = admin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (!body.all && body.id) {
    query = admin
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .eq("id", body.id);
  }
  const { error } = await query;
  return NextResponse.json({ ok: !error });
}
