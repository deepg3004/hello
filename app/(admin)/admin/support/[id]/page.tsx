import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { type SupportMessage } from "@/components/support/SupportThread";
import { LiveSupportThread } from "@/components/support/LiveSupportThread";
import { AdminSupportReply } from "@/components/admin/AdminSupportReply";

export const metadata = { title: "Admin · Ticket" };

export default async function AdminTicketPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, status, from_email, from_name, user_id")
    .eq("id", params.id)
    .single();
  if (!ticket) notFound();

  const { data: msgs } = await admin
    .from("support_messages")
    .select("id, direction, body, created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });
  const messages: SupportMessage[] = (msgs ?? []).map((m) => ({
    id: m.id as string,
    direction: m.direction as string,
    body: m.body as string,
    createdAt: m.created_at as string,
  }));

  const sender =
    (ticket.from_name as string) || (ticket.from_email as string) || "Customer";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>
      <div>
        <h1 className="font-sora text-xl font-semibold">{ticket.subject as string}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {sender} · {ticket.from_email as string}
        </p>
      </div>

      <div className="card-surface p-5">
        <LiveSupportThread
          ticketId={ticket.id as string}
          initialMessages={messages}
          inboundLabel={sender}
          outboundLabel="You"
        />
      </div>

      <AdminSupportReply ticketId={ticket.id as string} status={ticket.status as string} />
    </div>
  );
}
