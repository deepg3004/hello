// =============================================================================
// Invoice generator — orchestrates fetch → compute → render → store.
//
// Exposed entry points:
//   generateInvoice(order_id)         — full pipeline, used by the BullMQ worker
//   getInvoiceSignedUrl(invoice_id)   — fresh 7-day signed URL for downloads
//
// Everything in here is server-only. Puppeteer + node:fs are loaded lazily so
// the file can be imported (for types) from the front-end without crashing the
// edge bundler.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  amountInWords,
  computeTaxSplit,
  financialYearCode,
  formatInvoiceNumber,
  sellerInitials,
  stateNameFromCode,
} from "@/lib/gst";

const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const STORAGE_BUCKET = "invoices";

interface OrderRow {
  id: string;
  page_id: string | null;
  seller_user_id: string;
  product_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_gstin: string | null;
  buyer_state_code: string | null;
  buyer_address: Record<string, unknown> | null;
  amount: string | number;
  discount_amount: string | number | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  paid_at: string | null;
  status: string;
  currency: string | null;
  bump_title?: string | null;
  source?: string | null;
}

interface SellerRow {
  id: string;
  full_name: string | null;
  email: string;
  legal_business_name: string | null;
  gstin: string | null;
  state_code: string | null;
  default_hsn_sac: string | null;
  default_gst_rate: string | number | null;
  gst_address: Record<string, string | null> | null;
}

interface ProductRow {
  id: string;
  name: string;
}

interface CartLineItem {
  name: string;
  unit_price: number;
  quantity: number;
  line_amount: number;
}

export interface GenerateInvoiceResult {
  ok: boolean;
  invoice_id?: string;
  invoice_number?: string;
  signed_url?: string;
  storage_path?: string;
  skipped?: "no_gst_profile" | "already_generated" | "order_not_paid";
  message?: string;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export async function generateInvoice(
  orderId: string,
): Promise<GenerateInvoiceResult> {
  const admin = createAdminClient();

  // 1. Fetch the order.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, page_id, seller_user_id, product_id, buyer_email, buyer_name, buyer_phone, buyer_gstin, buyer_state_code, buyer_address, amount, discount_amount, gateway_order_id, gateway_payment_id, paid_at, status, currency, bump_title, source",
    )
    .eq("id", orderId)
    .single<OrderRow>();
  if (orderErr || !order) {
    return { ok: false, message: orderErr?.message ?? "Order not found" };
  }
  if (order.status !== "paid") {
    return { ok: false, skipped: "order_not_paid", message: "Order not paid" };
  }

  // 2. Skip if already generated.
  const { data: existing } = await admin
    .from("invoices")
    .select("id, invoice_number, pdf_storage_path, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing?.status === "generated" && existing.pdf_storage_path) {
    const signed = await freshSignedUrl(existing.pdf_storage_path);
    return {
      ok: true,
      invoice_id: existing.id,
      invoice_number: existing.invoice_number,
      signed_url: signed,
      storage_path: existing.pdf_storage_path,
      skipped: "already_generated",
    };
  }

  // 3. Load seller GST profile.
  const { data: seller } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, legal_business_name, gstin, state_code, default_hsn_sac, default_gst_rate, gst_address",
    )
    .eq("id", order.seller_user_id)
    .single<SellerRow>();
  if (!seller || !seller.gstin || !seller.state_code) {
    // Mark the queued row failed so the seller can see why no invoice was
    // produced, then bail.
    await upsertInvoice(orderId, {
      seller_user_id: order.seller_user_id,
      status: "failed",
      failure_reason: "Seller has no GST profile",
    });
    return { ok: false, skipped: "no_gst_profile" };
  }

  // 4. Product (for the line description).
  let product: ProductRow | null = null;
  if (order.product_id) {
    const { data } = await admin
      .from("products")
      .select("id, name")
      .eq("id", order.product_id)
      .single<ProductRow>();
    product = data ?? null;
  }
  // Cart orders have no single product — render each order_item as its own
  // invoice line. We pull the lines here and pass them to the renderer.
  let cartLines: CartLineItem[] | null = null;
  if (!product && order.source === "cart") {
    const { data: items } = await admin
      .from("order_items")
      .select("name_snapshot, variant_name, unit_price, quantity, line_amount")
      .eq("order_id", orderId);
    cartLines = (items ?? []).map((i) => ({
      name: i.variant_name ? `${i.name_snapshot} — ${i.variant_name}` : i.name_snapshot,
      unit_price: Number(i.unit_price ?? 0),
      quantity: Number(i.quantity ?? 1),
      line_amount: Number(i.line_amount ?? 0),
    }));
  }

  // 5. Decide invoice type + tax split.
  const rate = Number(seller.default_gst_rate ?? 18);
  const split = computeTaxSplit({
    gross_amount: Number(order.amount),
    rate,
    seller_state_code: seller.state_code,
    buyer_state_code: order.buyer_state_code,
    inclusive: true,
  });
  const invoiceType: "tax_invoice" | "bill_of_supply" =
    rate === 0 ? "bill_of_supply" : "tax_invoice";

  // 6. Mint the next sequence number for this seller + FY.
  const fy = financialYearCode(new Date(order.paid_at ?? Date.now()));
  const sequenceNum = await nextSequenceNumber(seller.id, fy);
  const initials = sellerInitials(
    seller.legal_business_name ?? seller.full_name,
  );
  const invoiceNumber = formatInvoiceNumber(initials, fy, sequenceNum);

  // 7. Insert / update the invoices row in "generating" state. We mint the row
  //    BEFORE rendering the PDF so failures still leave a debuggable record.
  const placeOfSupply = stateNameFromCode(
    order.buyer_state_code ?? seller.state_code,
  );
  const invoiceId = await upsertInvoice(orderId, {
    seller_user_id: seller.id,
    invoice_number: invoiceNumber,
    financial_year: fy,
    sequence_num: sequenceNum,
    invoice_type: invoiceType,
    place_of_supply: placeOfSupply,
    buyer_name: order.buyer_name,
    buyer_email: order.buyer_email,
    buyer_gstin: order.buyer_gstin,
    buyer_address: order.buyer_address as Record<string, unknown> | null,
    buyer_state_code: order.buyer_state_code,
    seller_gstin: seller.gstin,
    seller_state_code: seller.state_code,
    hsn_sac: seller.default_hsn_sac,
    taxable_amount: split.taxable_amount,
    tax_rate: split.rate,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
    total_amount: split.total_amount,
    amount_in_words: amountInWords(split.total_amount),
    invoice_date: order.paid_at ?? new Date().toISOString(),
    status: "generating",
    failure_reason: null,
  });

  // 8. Render the PDF.
  let pdfBytes: Buffer;
  try {
    const html = await renderInvoiceHtml({
      invoiceType,
      invoiceNumber,
      invoiceDate: order.paid_at ?? new Date().toISOString(),
      placeOfSupply,
      split,
      order,
      seller,
      product,
      cartLines,
      hsn: seller.default_hsn_sac ?? "—",
    });
    pdfBytes = await htmlToPdf(html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("invoices")
      .update({ status: "failed", failure_reason: msg })
      .eq("id", invoiceId);
    return { ok: false, message: msg };
  }

  // 9. Upload to private storage.
  const storagePath = `${seller.id}/${fy}/${invoiceNumber}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    await admin
      .from("invoices")
      .update({ status: "failed", failure_reason: uploadErr.message })
      .eq("id", invoiceId);
    return { ok: false, message: uploadErr.message };
  }

  await admin
    .from("invoices")
    .update({
      status: "generated",
      pdf_storage_path: storagePath,
      // pdf_url is mainly kept for backwards-compat with admin views — the
      // real download always goes via the signed-URL endpoint.
      pdf_url: storagePath,
    })
    .eq("id", invoiceId);

  const signed = await freshSignedUrl(storagePath);
  return {
    ok: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    storage_path: storagePath,
    signed_url: signed,
  };
}

export async function getInvoiceSignedUrl(
  invoiceId: string,
): Promise<{ ok: boolean; signed_url?: string; message?: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("invoices")
    .select("pdf_storage_path, status")
    .eq("id", invoiceId)
    .single();
  if (!row?.pdf_storage_path) {
    return { ok: false, message: "Invoice not yet generated" };
  }
  const url = await freshSignedUrl(row.pdf_storage_path);
  if (!url) return { ok: false, message: "Couldn't sign URL" };
  return { ok: true, signed_url: url };
}

export async function getInvoiceForOrder(orderId: string): Promise<{
  id: string;
  invoice_number: string;
  status: string;
  pdf_storage_path: string | null;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select("id, invoice_number, status, pdf_storage_path")
    .eq("order_id", orderId)
    .maybeSingle();
  return data;
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

async function nextSequenceNumber(
  sellerId: string,
  fy: string,
): Promise<number> {
  // Plain SELECT max + 1 — no row-level lock since Postgres handles the
  // unique-on-(seller, fy, seq) gracefully via our unique index. If two
  // parallel workers race, the second insert will hit a constraint violation
  // and the caller can retry. Pragmatic given our ~few-RPS scale.
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select("sequence_num")
    .eq("seller_user_id", sellerId)
    .eq("financial_year", fy)
    .order("sequence_num", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data?.sequence_num as number | null) ?? 0;
  return last + 1;
}

async function upsertInvoice(
  orderId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    await admin.from("invoices").update(fields).eq("id", existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await admin
    .from("invoices")
    .insert({ order_id: orderId, ...fields })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(error?.message ?? "invoice insert failed");
  }
  return inserted.id as string;
}

async function freshSignedUrl(
  storagePath: string,
): Promise<string | undefined> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    return undefined;
  }
}

// ----------------------------------------------------------------------------
// Template render
// ----------------------------------------------------------------------------

let cachedTemplate: string | null = null;
async function loadTemplate(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  const file = path.join(process.cwd(), "templates", "invoice.html");
  cachedTemplate = await fs.readFile(file, "utf-8");
  return cachedTemplate;
}

interface RenderArgs {
  invoiceType: "tax_invoice" | "bill_of_supply";
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupply: string;
  split: ReturnType<typeof computeTaxSplit>;
  order: OrderRow;
  seller: SellerRow;
  product: ProductRow | null;
  cartLines: CartLineItem[] | null;
  hsn: string;
}

async function renderInvoiceHtml(args: RenderArgs): Promise<string> {
  const tpl = await loadTemplate();
  const inr = (n: number) =>
    n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const dateOnly = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const addr = args.seller.gst_address ?? {};
  const sellerAddress = [
    addr.line1,
    addr.line2,
    [addr.city, addr.pincode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const buyerAddr = args.order.buyer_address as
    | Record<string, string | null>
    | null;
  const buyerAddress = buyerAddr
    ? [
        buyerAddr.line1,
        buyerAddr.line2,
        [buyerAddr.city, buyerAddr.pincode].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

  // Tax rows
  let taxRows = "";
  if (args.split.kind === "intra") {
    taxRows += `<tr><td class="l">CGST @ ${args.split.rate / 2}%</td><td class="v">₹${inr(args.split.cgst)}</td></tr>`;
    taxRows += `<tr><td class="l">SGST @ ${args.split.rate / 2}%</td><td class="v">₹${inr(args.split.sgst)}</td></tr>`;
  } else if (args.split.kind === "inter") {
    taxRows += `<tr><td class="l">IGST @ ${args.split.rate}%</td><td class="v">₹${inr(args.split.igst)}</td></tr>`;
  } else {
    taxRows += `<tr><td class="l">Tax (exempt)</td><td class="v">—</td></tr>`;
  }

  const itemName =
    args.product?.name ?? args.order.bump_title ?? "Digital product / service";

  // Item rows. Single-product orders → one row at the order total. Cart orders →
  // one row per line item, with the order's net taxable allocated across lines
  // by gross weight so the column still sums to the Subtotal exactly.
  const itemNote =
    args.invoiceType === "tax_invoice"
      ? "GST included in the rate shown"
      : "GST-exempt service";
  const row = (
    desc: string,
    note: string,
    hsn: string,
    qty: number,
    rate: number,
    discount: number,
    taxable: number,
  ) =>
    `<tr>
      <td><div class="item-desc">${escapeHtml(desc)}</div><div class="item-sub">${escapeHtml(note)}</div></td>
      <td class="c">${escapeHtml(hsn)}</td>
      <td class="c">${qty}</td>
      <td class="r">₹${inr(rate)}</td>
      <td class="r">₹${inr(discount)}</td>
      <td class="r">₹${inr(taxable)}</td>
    </tr>`;

  let itemRows = "";
  if (args.cartLines && args.cartLines.length > 0) {
    const grossSum = args.cartLines.reduce((a, l) => a + l.line_amount, 0) || 1;
    let allocated = 0;
    args.cartLines.forEach((l, idx) => {
      const last = idx === args.cartLines!.length - 1;
      // Allocate the order's net taxable by this line's share of gross; the last
      // line absorbs any rounding so the column sums to TOTAL_TAXABLE.
      const taxable = last
        ? Math.round((args.split.taxable_amount - allocated) * 100) / 100
        : Math.round(args.split.taxable_amount * (l.line_amount / grossSum) * 100) / 100;
      allocated += taxable;
      itemRows += row(l.name, itemNote, args.hsn, l.quantity, l.line_amount, 0, taxable);
    });
  } else {
    itemRows = row(
      itemName,
      itemNote,
      args.hsn,
      1,
      args.split.total_amount,
      Number(args.order.discount_amount ?? 0),
      args.split.taxable_amount,
    );
  }

  const subs: Record<string, string> = {
    INVOICE_HEADER: args.invoiceType === "tax_invoice"
      ? "Tax Invoice"
      : "Bill of Supply",
    INVOICE_NUMBER: args.invoiceNumber,
    INVOICE_DATE: dateOnly(args.invoiceDate),
    DUE_DATE: dateOnly(args.invoiceDate), // paid at issue time
    PLACE_OF_SUPPLY: args.placeOfSupply,
    SELLER_LEGAL_NAME:
      args.seller.legal_business_name ??
      args.seller.full_name ??
      "InvoxAI Seller",
    SELLER_ADDRESS: sellerAddress || "—",
    SELLER_STATE_NAME: stateNameFromCode(args.seller.state_code),
    SELLER_STATE_CODE: args.seller.state_code ?? "—",
    SELLER_GSTIN: args.seller.gstin ?? "—",
    SELLER_HSN: args.seller.default_hsn_sac ?? "—",
    BUYER_NAME: args.order.buyer_name ?? "Customer",
    BUYER_EMAIL: args.order.buyer_email,
    BUYER_PHONE: args.order.buyer_phone ?? "—",
    BUYER_ADDRESS: buyerAddress,
    BUYER_GSTIN: args.order.buyer_gstin ?? "—",
    TOTAL_TAXABLE: inr(args.split.taxable_amount),
    TAX_ROWS: taxRows,
    GRAND_TOTAL: inr(args.split.total_amount),
    AMOUNT_IN_WORDS: amountInWords(args.split.total_amount),
    PAYMENT_DATE: dateTime(args.invoiceDate),
    PAYMENT_REFERENCE: args.order.gateway_payment_id ?? "—",
    GATEWAY_ORDER_ID: args.order.gateway_order_id ?? "—",
  };

  let html = tpl;
  for (const [k, v] of Object.entries(subs)) {
    html = html.split(`{{${k}}}`).join(escapeHtml(String(v)));
  }
  // The TAX_ROWS block is HTML, not text; replace again without escaping.
  html = html.replace(escapeHtml(taxRows), taxRows);
  // ITEM_ROWS is pre-escaped HTML (each cell escaped at build time) — insert raw.
  html = html.split("{{ITEM_ROWS}}").join(itemRows);
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ----------------------------------------------------------------------------
// PDF render — lazy import puppeteer so we don't pay for it in non-PDF code paths
// ----------------------------------------------------------------------------

async function htmlToPdf(html: string): Promise<Buffer> {
  // Lazy import so the Edge / client bundlers never see the puppeteer module.
  const puppeteer = (await import("puppeteer")).default;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  try {
    const page = await browser.newPage();
    // Puppeteer's TS definitions for setContent narrow waitUntil to "load" |
    // "domcontentloaded" in this version, but the runtime still honours
    // "networkidle0" — and we want it to so web fonts / inlined SVG settle
    // before the PDF snapshots. Cast through to keep the wait behaviour.
    await page.setContent(html, {
      waitUntil: "networkidle0" as unknown as "load",
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
