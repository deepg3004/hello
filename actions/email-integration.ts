"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

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
      .eq("user_id", user.id)
      .maybeSingle();
    password_enc = existing?.password_enc ?? null;
  }
  if (!password_enc) {
    return { ok: false, message: "Enter the SMTP password." };
  }

  const { error } = await admin.from("seller_smtp").upsert(
    {
      user_id: user.id,
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const cfg = await loadSellerSmtp(user.id);
  if (!cfg) {
    return { ok: false, message: "Save active SMTP settings first." };
  }
  const to = user.email;
  if (!to) return { ok: false, message: "No email on your account to send a test to." };

  const res = await sendViaSellerSmtp(cfg, {
    to,
    subject: "InvoxAI SMTP test ✅",
    html: `<p>Your custom SMTP is working — this test email was sent from <strong>${cfg.fromEmail}</strong>.</p>`,
  });
  return res.ok
    ? { ok: true, message: `Sent a test to ${to}.` }
    : { ok: false, message: res.message ?? "Send failed." };
}
