// GET /api/support/[id]/messages
//
// Powers the live (short-poll) support chat. Reuses the existing server-side
// auth model — no client-side RLS surface: the caller must be an admin OR the
// ticket's owner (seller). Returns the ticket's messages in order.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: ticket }] = await Promise.all([
    admin.from("user_profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    admin.from("support_tickets").select("id, user_id").eq("id", params.id).maybeSingle(),
  ]);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!profile?.is_admin && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: msgs } = await admin
    .from("support_messages")
    .select("id, direction, body, created_at")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    messages: (msgs ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      createdAt: m.created_at,
    })),
  });
}
