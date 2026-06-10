// =============================================================================
// Notification delivery log (migration 090) — best-effort audit of external
// (email / WhatsApp / SMS) sends. Server-only. NEVER throws and NEVER blocks
// the send it observes — call it fire-and-forget (`void logNotification(...)`).
// Only metadata is stored (recipient, subject, status) — never message bodies.
// =============================================================================

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotifChannel = "email" | "whatsapp" | "sms";
export type NotifStatus = "sent" | "failed" | "skipped";

/** The shared shape every sender returns ({ ok, skipped?, message? }). */
export interface SenderResult {
  ok: boolean;
  skipped?: boolean;
  message?: string;
}

export function statusOf(r: SenderResult): NotifStatus {
  if (r.skipped) return "skipped";
  return r.ok ? "sent" : "failed";
}

export interface LogEntry {
  channel: NotifChannel;
  recipient: string;
  subject?: string | null;
  eventKey?: string | null;
  sellerId?: string | null;
  provider?: string | null;
  result: SenderResult;
}

export async function logNotification(entry: LogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notification_logs").insert({
      channel: entry.channel,
      recipient: (entry.recipient ?? "").slice(0, 320),
      subject: entry.subject ? entry.subject.slice(0, 300) : null,
      event_key: entry.eventKey ? entry.eventKey.slice(0, 120) : null,
      seller_user_id: entry.sellerId ?? null,
      status: statusOf(entry.result),
      provider: entry.provider ?? null,
      error: entry.result.message ? entry.result.message.slice(0, 500) : null,
    });
  } catch {
    /* logging must never affect the send — swallow everything */
  }
}
