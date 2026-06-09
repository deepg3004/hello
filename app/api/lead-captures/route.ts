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
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { fireMarketingWebhook } from "@/lib/marketing";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/emails/render";
import {
  normalizeTags,
  resolvedFormConfig,
  type FormConfig,
  type LeadMagnetMeta,
} from "@/lib/leads";
import { getRedis } from "@/lib/redis";
import { conversionsKey, variantCookieName } from "@/lib/ab";

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

  // Rate limit: 30 per minute per IP — blunts lead-form spam (audit #13).
  const rl = await rateLimit(`lead:${clientIp(request)}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
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
      "id, user_id, slug, title, status, page_config, experiment_status, user_profiles!pages_user_id_fkey(full_name, email)",
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

  // A/B — sniff variant cookie for the page (if experiment is running).
  let expVariant: "A" | "B" | null = null;
  if (page.experiment_status === "running" && page.slug) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const want = variantCookieName(page.slug);
    const match = cookieHeader
      .split(/;\s*/)
      .find((p) => p.startsWith(`${want}=`));
    const val = match?.split("=")[1];
    if (val === "A" || val === "B") expVariant = val;
  }

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
      exp_variant: expVariant,
    })
    .select("id")
    .single();

  // A/B — fire the conversion counter once we know the lead landed.
  if (expVariant && page.slug) {
    try {
      const redis = getRedis();
      if (redis) await redis.incr(conversionsKey(page.slug, expVariant));
    } catch (e) {
      console.error("[lead-captures] AB INCR failed", e);
    }
  }
  if (insertErr || !insertedRaw) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  const leadId = insertedRaw.id as string;

  // Marketing: outbound webhook (best-effort).
  await fireMarketingWebhook(page.user_id, "lead_created", {
    lead_id: leadId,
    email,
    name: name ?? null,
    page_id,
  });

  // Drip automation: enroll into any active 'lead_created' sequences.
  try {
    const { enrollInSequences } = await import("@/lib/sequences");
    await enrollInSequences(
      { sellerUserId: page.user_id, trigger: "lead_created", email, name: name ?? null },
      admin,
    );
  } catch (e) {
    console.error("[lead-captures] sequence enroll failed", e);
  }

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
    const tpl = await renderEmail("lead_confirmation", {
      leadName: name ?? undefined,
      subject: cfg.confirmation_email_subject,
      body: cfg.confirmation_email_body,
      pageTitle: page.title,
    });
    sideEffects.push(
      sendEmail({ to: email, role: "buyer", subject: tpl.subject, html: tpl.html, sellerId: page.user_id }).then(async (r) => {
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
    const tpl = await renderEmail("lead_magnet", {
      leadName: name ?? undefined,
      pageTitle: page.title,
      downloadUrl,
    });
    sideEffects.push(
      sendEmail({ to: email, role: "buyer", subject: tpl.subject, html: tpl.html, sellerId: page.user_id }).then(async (r) => {
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
    const tpl = await renderEmail("lead_alert", {
      sellerName: seller.full_name ?? undefined,
      leadName: name ?? undefined,
      leadEmail: email,
      leadPhone: phone ?? undefined,
      pageTitle: page.title,
      customFields: custom_fields,
      crmUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}/dashboard/leads`,
    });
    sideEffects.push(
      sendEmail({ to: seller.email, role: "seller", subject: tpl.subject, html: tpl.html }),
    );
  }

  // 5d. Outbound webhook (Zapier/Make).
  if (cfg.webhook_url) {
    const webhookUrl = cfg.webhook_url;
    sideEffects.push(
      (async () => {
        // SSRF guard: a seller-supplied URL must never hit internal/metadata
        // hosts (mirrors lib/marketing.ts fireMarketingWebhook).
        try {
          const { assertPublicHttpUrl } = await import("@/lib/safe-url");
          await assertPublicHttpUrl(webhookUrl);
        } catch {
          return null;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            redirect: "manual",
            signal: controller.signal,
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
          });
        } catch {
          /* best-effort */
        } finally {
          clearTimeout(timer);
        }
        return null;
      })(),
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

  // 5f. Meta CAPI — server-side Lead event for this page.
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
    const secret = process.env.CRON_SECRET ?? "";
    sideEffects.push(
      fetch(`${baseUrl}/api/pixels/meta-capi`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": secret,
        },
        body: JSON.stringify({
          page_id,
          lead_id: leadId,
          event_name: "Lead",
          email,
          phone,
        }),
      }).catch(() => null),
    );
  } catch (e) {
    console.error("[lead-captures] CAPI dispatch failed", e);
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
