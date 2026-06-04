// GET /api/invoices/[id]/download
//
// Returns a fresh 7-day signed URL for the invoice PDF, gated on:
//   - the signed-in seller owns the invoice, OR
//   - the signed-in user is an admin, OR
//   - the caller passes ?order_token=<HMAC> matching the order (buyer link
//     embedded in the confirmation email — TODO once we wire it).
//
// Generates the PDF on-the-fly if it's still queued (so seller-side clicks
// don't have to wait for the worker).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext } from "@/lib/account-context";
import {
  generateInvoice,
  getInvoiceSignedUrl,
} from "@/lib/invoice-generator";

interface InvoiceRow {
  id: string;
  order_id: string | null;
  seller_user_id: string | null;
  status: string;
  pdf_storage_path: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getActorContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, order_id, seller_user_id, status, pdf_storage_path")
    .eq("id", params.id)
    .single<InvoiceRow>();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Authorisation: seller (or a team member with transactions access) OR admin
  const { data: caller } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", ctx.authUserId)
    .single();
  const isOwner =
    invoice.seller_user_id === ctx.ownerId && ctx.can("transactions.view");
  const isAdmin = !!caller?.is_admin;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate on-the-fly if the worker hasn't processed yet.
  if (invoice.status !== "generated" || !invoice.pdf_storage_path) {
    if (!invoice.order_id) {
      return NextResponse.json(
        { error: "Invoice is in a broken state — no source order" },
        { status: 500 },
      );
    }
    const result = await generateInvoice(invoice.order_id);
    if (!result.ok || !result.signed_url) {
      return NextResponse.json(
        { error: result.message ?? "Couldn't generate invoice" },
        { status: 502 },
      );
    }
    const url = new URL(request.url);
    if (url.searchParams.get("json") === "1") {
      return NextResponse.json({ ok: true, signed_url: result.signed_url });
    }
    return NextResponse.redirect(result.signed_url, 302);
  }

  const url = await getInvoiceSignedUrl(params.id);
  if (!url.ok || !url.signed_url) {
    return NextResponse.json(
      { error: url.message ?? "Couldn't sign URL" },
      { status: 500 },
    );
  }
  const reqUrl = new URL(request.url);
  if (reqUrl.searchParams.get("json") === "1") {
    return NextResponse.json({ ok: true, signed_url: url.signed_url });
  }
  return NextResponse.redirect(url.signed_url, 302);
}
