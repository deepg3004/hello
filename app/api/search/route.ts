// GET /api/search?q=...
//
// Powers the dashboard command palette. Searches the CURRENT seller's own
// pages (by title) and orders (by buyer name/email) and returns grouped,
// link-ready results. Filters strictly by the authenticated user id, so it's
// safe to use the service-role client (no cross-seller leakage).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();

  // Sanitise for PostgREST filter values: ilike patterns and .or() lists choke
  // on %, _, commas and parentheses. Keep it to safe, searchable characters.
  const q = raw.replace(/[%_(),*]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) {
    return NextResponse.json({ pages: [], customers: [], transactions: [] });
  }

  const ctx = await getActorContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const like = `%${q}%`;

  const [pagesRes, ordersRes] = await Promise.all([
    admin
      .from("pages")
      .select("id, title, type")
      .eq("user_id", ctx.ownerId)
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("orders")
      .select("id, buyer_name, buyer_email, amount, status, created_at")
      .eq("seller_user_id", ctx.ownerId)
      .or(`buyer_name.ilike.${like},buyer_email.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const orders = ordersRes.data ?? [];

  // Unique customers (first occurrence — orders are newest-first).
  const seen = new Set<string>();
  const customers: { name: string | null; email: string }[] = [];
  for (const o of orders) {
    const email = (o.buyer_email as string | null) ?? "";
    if (!email || seen.has(email)) continue;
    seen.add(email);
    customers.push({ name: (o.buyer_name as string | null) ?? null, email });
    if (customers.length >= 5) break;
  }

  const transactions = orders.slice(0, 6).map((o) => ({
    id: o.id as string,
    buyer: (o.buyer_name as string | null) ?? (o.buyer_email as string | null),
    amount: Number(o.amount ?? 0),
    status: o.status as string,
    created_at: o.created_at as string,
  }));

  return NextResponse.json({
    pages: pagesRes.data ?? [],
    customers,
    transactions,
  });
}
