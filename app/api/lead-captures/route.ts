// POST /api/lead-captures   (alias: POST /api/leads/capture)
//
// Body: {
//   page_id,
//   name?, email, phone?,
//   custom_fields?: Record<string, unknown>,
//   source?, utm?
// }
//
// Returns: {
//   ok: true,
//   success: true,
//   duplicate?: boolean,         // already submitted with this email
//   redirect_url?: string,       // post_action = redirect
//   download_url?: string,       // post_action = download with lead magnet
//   thanks_text?: string,        // post_action = thanks
// }

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  confirmationEmail,
  leadMagnetDeliveryEmail,
  newLeadNotificationEmail,
  sendEmail,
} from "@/lib/email";
import {
  normalizeTags,
  resolvedFormConfig,
  type FormConfig,
  type LeadMagnetMeta,
} from "@/lib/leads";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface PageConfig {
  form_config?: FormConfig | null;
  lead_magnet?: LeadMagnetMeta | null;
}

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    name?: string;
    email?: string;
    phone?: string | null;
    source?: string | null;
    utm?: Record<string, string>;
    custom_fields?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { page_id, name, email, phone, source, utm, custom_fields } = body;
  if (!page_id || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "page_id and a valid email are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 1. Load the page + its form / magnet config + seller.
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, slug, title, status, page_config, user_profiles!pages_user_id_fkey(full_name, email)",
    )
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Page is not live" }, { status: 404 });
  }

  const seller = Array.isArray(
    (page as unknown as { user_profiles: unknown }).user_profiles,
  )
    ? (page as unknown as { user_profiles: { full_name: string | null; email: string }[] })
        .user_profiles[0]
    : (page as unknown as { user_profiles: { full_name: string | null; email: string } | null })
        .user_profiles;

  const pageConfig = ((page.page_config as PageConfig | null) ?? {}) as PageConfig;
  const cfg = resolvedFormConfig(pageConfig.form_config);
  const magnet = pageConfig.lead_magnet ?? null;

  // 2. Duplicate count (we still insert — the CRM shows duplicates).
  const { count: dupCount } = await admin
    .from("lead_captures")
    .select("id", { count: "exact", head: true })
    .eq("page_id", page_id)
    .ilike("email", email);
  const duplicate = (dupCount ?? 0) > 0;

  // 3. Insert lead row.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const tags = normalizeTags(cfg.auto_tags ?? []);

  const { data: insertedRaw, error: insertErr } = await admin
    .from("lead_captures")
    .insert({
      page_id,
      seller_user_id: page.user_id,
      name: name ?? null,
      email,
      phone: phone ?? null,
      source: source ?? null,
      utm: utm ?? null,
      ip_address: ip,
      custom_fields: custom_fields ?? {},
      tags,
    })
    .select("id")
    .single();
  if (insertErr || !insertedRaw) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  const leadId = insertedRaw.id as string;

  // 4. Generate a signed URL for the lead magnet (if any). Best-effort.
  let downloadUrl: string | undefined;
  if (magnet?.path) {
    try {
      const { data, error } = await admin.storage
        .from("lead-magnets")
        .createSignedUrl(magnet.path, SIGNED_URL_TTL_SECONDS, {
          download: magnet.name,
        });
      if (!error && data?.signedUrl) downloadUrl = data.signedUrl;
    } catch {
      /* non-fatal */
    }
  }

  // 5. Side-effects in parallel — none can block the response.
  const sideEffects: Promise<unknown>[] = [];

  // 5a. Confirmation email to the lead.
  if (cfg.confirmation_email_enabled) {
    const tpl = confirmationEmail({
      leadName: name ?? undefined,
      subject: cfg.confirmation_email_subject,
      body: cfg.confirmation_email_body,
      pageTitle: page.title,
    });
    sideEffects.push(
      sendEmail({ to: email, subject: tpl.subject, html: tpl.html }).then(async (r) => {
        if (r.ok) {
          await admin
            .from("lead_captures")
            .update({ confirmed_at: new Date().toISOString() })
            .eq("id", leadId);
        }
      }),
    );
  }

  // 5b. Lead magnet delivery.
  if (downloadUrl) {
    const tpl = leadMagnetDeliveryEmail({
      leadName: name ?? undefined,
      pageTitle: page.title,
      downloadUrl,
    });
    sideEffects.push(
      sendEmail({ to: email, subject: tpl.subject, html: tpl.html }).then(async (r) => {
        if (r.ok) {
          await admin
            .from("lead_captures")
            .update({ delivered_magnet: true })
            .eq("id", leadId);
        }
      }),
    );
  }

  // 5c. Seller notification.
  if (cfg.notify_seller && seller?.email) {
    const tpl = newLeadNotificationEmail({
      sellerName: seller.full_name ?? undefined,
      leadName: name ?? undefined,
      leadEmail: email,
      leadPhone: phone ?? undefined,
      pageTitle: page.title,
      customFields: custom_fields,
      crmUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}/dashboard/leads`,
    });
    sideEffects.push(
      sendEmail({ to: seller.email, subject: tpl.subject, html: tpl.html }),
    );
  }

  // 5d. Outbound webhook (Zapier/Make).
  if (cfg.webhook_url) {
    sideEffects.push(
      fetch(cfg.webhook_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          page_id,
          page_slug: page.slug,
          name,
          email,
          phone,
          custom_fields,
          tags,
          utm,
          source,
          duplicate,
          captured_at: new Date().toISOString(),
        }),
      }).catch(() => null),
    );
  }

  // 5e. WhatsApp ping to the seller — best-effort, never throws.
  try {
    const { notifyNewLead } = await import("@/lib/notification-triggers");
    sideEffects.push(
      notifyNewLead({
        seller_user_id: page.user_id,
        name,
        email,
        phone: phone ?? null,
        page_id,
        page_title: page.title,
      }),
    );
  } catch (e) {
    console.error("[lead-captures] notifyNewLead dispatch failed", e);
  }

  await Promise.allSettled(sideEffects);

  // 6. Response — based on post_action.
  const out: Record<string, unknown> = {
    ok: true,
    success: true,
    duplicate,
  };
  if (cfg.post_action === "redirect" && cfg.redirect_url) {
    out.redirect_url = cfg.redirect_url;
  } else if (cfg.post_action === "download" && downloadUrl) {
    out.download_url = downloadUrl;
  } else {
    out.thanks_text = cfg.thanks_text;
  }
  return NextResponse.json(out);
}
