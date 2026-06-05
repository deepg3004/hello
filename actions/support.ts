"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";
import { notifyAdmins, createNotification } from "@/lib/notifications/create";
import { sendEmail } from "@/lib/email";

interface Result {
  ok: boolean;
  message?: string;
  ticketId?: string;
}

const STATUSES = ["open", "in_progress", "resolved"] as const;
type TicketStatus = (typeof STATUSES)[number];

// ─── Seller: open a ticket / reply on their own ─────────────────────────────

export async function createSupportTicketAction(input: {
  subject: string;
  body: string;
}): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const subject = input.subject?.trim();
  const body = input.body?.trim();
  if (!subject || !body) return { ok: false, message: "Subject and message are required." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  const email = profile?.email ?? user.email ?? "";

  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      subject,
      from_email: email,
      from_name: profile?.full_name ?? null,
      user_id: user.id,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !ticket) {
    return { ok: false, message: error?.message ?? "Couldn't create the ticket." };
  }

  await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    direction: "inbound",
    from_email: email,
    body,
  });

  await notifyAdmins({
    type: "support_ticket",
    title: "New support ticket",
    body: subject,
    link: `/admin/support/${ticket.id}`,
  });

  revalidatePath("/dashboard/support");
  return { ok: true, ticketId: ticket.id };
}

/** Seller adds a follow-up message to their OWN ticket. */
export async function addSupportReplyAction(input: {
  ticketId: string;
  body: string;
}): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const body = input.body?.trim();
  if (!body) return { ok: false, message: "Message is required." };

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, user_id, from_email, subject")
    .eq("id", input.ticketId)
    .single();
  if (!ticket || ticket.user_id !== user.id) {
    return { ok: false, message: "Not your ticket." };
  }

  await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    direction: "inbound",
    from_email: ticket.from_email,
    body,
  });
  await admin
    .from("support_tickets")
    .update({ status: "open", last_message_at: new Date().toISOString() })
    .eq("id", ticket.id);

  await notifyAdmins({
    type: "support_ticket",
    title: "Support ticket reply",
    body: ticket.subject as string,
    link: `/admin/support/${ticket.id}`,
  });

  revalidatePath(`/dashboard/support/${ticket.id}`);
  return { ok: true };
}

// ─── Admin: reply + status ──────────────────────────────────────────────────

export async function replySupportTicketAction(input: {
  ticketId: string;
  body: string;
}): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { ok: false, message: "Admin only" };
  }
  const body = input.body?.trim();
  if (!body) return { ok: false, message: "Message is required." };

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, from_email, subject, user_id")
    .eq("id", input.ticketId)
    .single();
  if (!ticket) return { ok: false, message: "Ticket not found." };

  await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    direction: "outbound",
    from_email: null,
    body,
    sent_by_admin_id: adminId,
  });
  await admin
    .from("support_tickets")
    .update({ status: "in_progress", last_message_at: new Date().toISOString() })
    .eq("id", ticket.id);

  // Notify the requester — in-app (if a known user) + email.
  if (ticket.user_id) {
    await createNotification({
      userId: ticket.user_id as string,
      type: "support_reply",
      title: "Support replied",
      body: ticket.subject as string,
      link: `/dashboard/support/${ticket.id}`,
    });
  }
  if (ticket.from_email) {
    try {
      await sendEmail({
        to: ticket.from_email as string,
        role: "noreply",
        subject: `Re: ${ticket.subject}`,
        html: `<p>${body.replace(/\n/g, "<br/>")}</p><p style="color:#64748b;font-size:13px">Reply to this email or from your InvoxAI dashboard → Help &amp; Support.</p>`,
      });
    } catch {
      /* non-fatal */
    }
  }

  await writeAuditLog({
    admin_id: adminId,
    action: "support.reply",
    target_type: "support_ticket",
    target_id: ticket.id as string,
  });

  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function setTicketStatusAction(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { ok: false, message: "Admin only" };
  }
  if (!STATUSES.includes(input.status)) return { ok: false, message: "Bad status." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_tickets")
    .update({
      status: input.status,
      resolved_at: input.status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", input.ticketId);
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    admin_id: adminId,
    action: "support.status",
    target_type: "support_ticket",
    target_id: input.ticketId,
    details: { status: input.status },
  });

  revalidatePath(`/admin/support/${input.ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}
