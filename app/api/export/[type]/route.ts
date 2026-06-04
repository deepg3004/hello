// GET /api/export/{orders|customers|leads}.csv
//
// Streams the signed-in seller's own data as CSV. Always scoped to the session
// user (seller_user_id) — never trusts a client id. Capped at 10k rows.

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";
import { toCsv } from "@/lib/csv";
import type { Capability } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
type ExportType = "orders" | "customers" | "leads";

export async function GET(
  _req: Request,
  { params }: { params: { type: string } },
) {
  const type = params.type.replace(/\.csv$/, "") as ExportType;
  if (!["orders", "customers", "leads"].includes(type)) {
    return new Response("Unknown export type", { status: 404 });
  }

  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  const needed: Capability =
    type === "leads" ? "leads.view" : type === "customers" ? "customers.view" : "transactions.view";
  if (!ctx.can(needed)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  if (type === "orders") {
    const { data } = await admin
      .from("orders")
      .select("created_at, buyer_name, buyer_email, buyer_phone, amount, status, coupon_code, pages(title)")
      .eq("seller_user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    headers = ["Date", "Buyer name", "Buyer email", "Phone", "Amount (INR)", "Status", "Coupon", "Page"];
    rows = (data ?? []).map((o) => {
      const page = Array.isArray(o.pages) ? o.pages[0] : o.pages;
      return [
        o.created_at,
        o.buyer_name,
        o.buyer_email,
        (o as { buyer_phone?: string }).buyer_phone ?? "",
        o.amount,
        o.status,
        (o as { coupon_code?: string }).coupon_code ?? "",
        (page as { title?: string } | null)?.title ?? "",
      ];
    });
  } else if (type === "customers") {
    // Aggregate paid orders by buyer email.
    const { data } = await admin
      .from("orders")
      .select("buyer_name, buyer_email, amount, created_at")
      .eq("seller_user_id", ctx.ownerId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    const byEmail = new Map<
      string,
      { name: string; email: string; orders: number; total: number; last: string }
    >();
    for (const o of data ?? []) {
      const email = (o.buyer_email ?? "").toLowerCase();
      if (!email) continue;
      const cur = byEmail.get(email);
      if (cur) {
        cur.orders += 1;
        cur.total += Number(o.amount ?? 0);
      } else {
        byEmail.set(email, {
          name: o.buyer_name ?? "",
          email: o.buyer_email ?? "",
          orders: 1,
          total: Number(o.amount ?? 0),
          last: o.created_at,
        });
      }
    }
    headers = ["Name", "Email", "Orders", "Total spent (INR)", "Last order"];
    rows = [...byEmail.values()].map((c) => [c.name, c.email, c.orders, c.total, c.last]);
  } else {
    const { data } = await admin
      .from("lead_captures")
      .select("created_at, name, email, phone, utm_source, pages(title)")
      .eq("seller_user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    headers = ["Date", "Name", "Email", "Phone", "Source", "Page"];
    rows = (data ?? []).map((l) => {
      const page = Array.isArray(l.pages) ? l.pages[0] : l.pages;
      return [
        l.created_at,
        l.name,
        l.email,
        l.phone,
        l.utm_source,
        (page as { title?: string } | null)?.title ?? "",
      ];
    });
  }

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="invoxai-${type}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
