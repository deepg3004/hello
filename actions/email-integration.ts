"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { encryptValue, vaultConfigured } from "@/lib/admin/vault";
import { loadSellerSmtp, sendViaSellerSmtp } from "@/lib/seller-smtp";

interface Result {
  ok: boolean;
  message?: string;
}

export async function saveSellerSmtpAction(input: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string; // blank on edit = keep existing
  from_name?: string | null;
  from_email: string;
  reply_to?: string | null;
  active: boolean;
}): Promise<Result> {
  const actor = await requireActor("email.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  if (!input.host?.trim() || !input.username?.trim() || !input.from_email?.trim()) {
    return { ok: false, message: "Host, username and from-email are required." };
  }
  if (!vaultConfigured()) {
    return { ok: false, message: "Server vault key isn't configured. Contact support." };
  }

  const admin = createAdminClient();

  // Resolve the password to store: new one (encrypted) or keep the existing.
  let password_enc: string | null = null;
  if (input.password && input.password.trim()) {
    password_enc = encryptValue(input.password.trim());
  } else {
    const { data: existing } = await admin
      .from("seller_smtp")
      .select("password_enc")
      .eq("user_id", ctx.ownerId)
      .maybeSingle();
    password_enc = existing?.password_enc ?? null;
  }
  if (!password_enc) {
    return { ok: false, message: "Enter the SMTP password." };
  }

  const { error } = await admin.from("seller_smtp").upsert(
    {
      user_id: ctx.ownerId,
      host: input.host.trim(),
      port: Math.floor(Number(input.port) || 587),
      secure: !!input.secure,
      username: input.username.trim(),
      password_enc,
      from_name: input.from_name?.trim() || null,
      from_email: input.from_email.trim(),
      reply_to: input.reply_to?.trim() || null,
      active: input.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/email");
  return { ok: true };
}

export async function testSellerSmtpAction(): Promise<Result> {
  const actor = await requireActor("email.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const cfg = await loadSellerSmtp(ctx.ownerId);
  if (!cfg) {
    return { ok: false, message: "Save active SMTP settings first." };
  }
  // Send the test to the address they configured as the sender — proves the
  // SMTP works end-to-end into a mailbox they control.
  const to = cfg.fromEmail;

  const res = await sendViaSellerSmtp(cfg, {
    to,
    subject: "InvoxAI SMTP test ✅",
    html: `<p>Your custom SMTP is working — this test email was sent from <strong>${cfg.fromEmail}</strong>.</p>`,
  });
  return res.ok
    ? { ok: true, message: `Sent a test to ${to}.` }
    : { ok: false, message: res.message ?? "Send failed." };
}

/**
 * S14 — record the verified sending domain for the seller's email integration.
 * Stored alongside their SMTP row; surfaced in the connect UI so they know which
 * domain their buyer-facing mail leaves from. Pass null/empty to clear.
 */
export async function setSendingDomainAction(domain: string | null): Promise<Result> {
  const actor = await requireActor("email.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const value = domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
  if (value && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
    return { ok: false, message: "Enter a valid domain (e.g. mail.yourbrand.com)." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("seller_smtp")
    .select("user_id")
    .eq("user_id", ctx.ownerId)
    .maybeSingle();
  if (!existing) {
    return { ok: false, message: "Save your SMTP settings first." };
  }

  const { error } = await admin
    .from("seller_smtp")
    .update({ sending_domain: value, updated_at: new Date().toISOString() })
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/email");
  return { ok: true, message: value ? `Sending domain set to ${value}.` : "Sending domain cleared." };
}
