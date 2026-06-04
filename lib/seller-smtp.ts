// Seller custom SMTP (Session 14). When a seller configures + activates their
// own SMTP, their buyer-facing emails send from their domain. Server-side
// (nodemailer + admin client + vault). Best-effort: a failure returns
// {ok:false} so the caller falls back to the platform mailbox.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptValue, vaultConfigured } from "@/lib/admin/vault";

export interface SellerSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  pass: string;
  fromName: string | null;
  fromEmail: string;
  replyTo: string | null;
}

const CONFIG_TTL_MS = 60_000;
const cache = new Map<
  string,
  { value: SellerSmtpConfig | null; expires_at: number }
>();
const transports = new Map<string, Transporter>();

export async function loadSellerSmtp(
  sellerId: string,
): Promise<SellerSmtpConfig | null> {
  const c = cache.get(sellerId);
  if (c && c.expires_at > Date.now()) return c.value;

  let value: SellerSmtpConfig | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("seller_smtp")
      .select(
        "host, port, secure, username, password_enc, from_name, from_email, reply_to, active",
      )
      .eq("user_id", sellerId)
      .maybeSingle();
    if (data && data.active && data.host && data.username && data.from_email) {
      let pass = "";
      if (data.password_enc && vaultConfigured()) {
        try {
          pass = decryptValue(data.password_enc);
        } catch {
          pass = "";
        }
      }
      if (pass) {
        value = {
          host: data.host,
          port: Number(data.port) || 587,
          secure: !!data.secure,
          username: data.username,
          pass,
          fromName: data.from_name ?? null,
          fromEmail: data.from_email,
          replyTo: data.reply_to ?? null,
        };
      }
    }
  } catch {
    value = null;
  }
  cache.set(sellerId, { value, expires_at: Date.now() + CONFIG_TTL_MS });
  return value;
}

function transportFor(cfg: SellerSmtpConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.username}:${cfg.pass}`;
  let tx = transports.get(key);
  if (tx) return tx;
  tx = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.username, pass: cfg.pass },
  });
  transports.set(key, tx);
  return tx;
}

export async function sendViaSellerSmtp(
  cfg: SellerSmtpConfig,
  args: { to: string; subject: string; html: string; text?: string; replyTo?: string },
): Promise<{ ok: boolean; id?: string; message?: string }> {
  try {
    const info = await transportFor(cfg).sendMail({
      from: `${cfg.fromName ?? "InvoxAI"} <${cfg.fromEmail}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo ?? cfg.replyTo ?? undefined,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Try the seller's SMTP for a buyer-facing email. Returns true when sent. */
export async function trySellerEmail(
  sellerId: string,
  args: { to: string; subject: string; html: string; text?: string; replyTo?: string },
): Promise<boolean> {
  const cfg = await loadSellerSmtp(sellerId);
  if (!cfg) return false;
  const res = await sendViaSellerSmtp(cfg, args);
  if (!res.ok) {
    console.warn("[seller-smtp] send failed, falling back to platform", res.message);
  }
  return res.ok;
}
