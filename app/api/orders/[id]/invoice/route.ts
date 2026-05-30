// GET /api/orders/[id]/invoice
//
// Public (un-authenticated) — the order id is a UUID and acts as the secret.
// The /order/[id] page already exposes the same information to anyone who
// knows the order id, so this is the same security model.
//
// If the invoice hasn't been generated yet, we trigger generation inline so
// the buyer always gets a working link from the email.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateInvoice,
  getInvoiceSignedUrl,
} from "@/lib/invoice-generator";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", params.id)
    .single();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Order not yet paid — no invoice." },
      { status: 409 },
    );
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status, pdf_storage_path")
    .eq("order_id", params.id)
    .maybeSingle();

  let signedUrl: string | undefined;

  if (invoice?.status === "generated" && invoice.pdf_storage_path) {
    const fresh = await getInvoiceSignedUrl(invoice.id);
    signedUrl = fresh.signed_url;
  } else {
    // Worker hasn't reached this row yet — generate inline.
    const result = await generateInvoice(params.id);
    if (!result.ok || !result.signed_url) {
      return NextResponse.json(
        { error: result.message ?? "Couldn't generate invoice" },
        { status: 502 },
      );
    }
    signedUrl = result.signed_url;
  }

  if (!signedUrl) {
    return NextResponse.json(
      { error: "Couldn't sign invoice URL" },
      { status: 500 },
    );
  }
  const reqUrl = new URL(request.url);
  if (reqUrl.searchParams.get("json") === "1") {
    return NextResponse.json({ ok: true, signed_url: signedUrl });
  }
  return NextResponse.redirect(signedUrl, 302);
}
