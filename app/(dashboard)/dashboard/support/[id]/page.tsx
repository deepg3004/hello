import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type SupportMessage } from "@/components/support/SupportThread";
import { LiveSupportThread } from "@/components/support/LiveSupportThread";
import { SupportReply } from "@/components/dashboard/support/SupportReply";

export const metadata = { title: "Support ticket" };

export default async function SellerTicketPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/support/${params.id}`);

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, status, user_id")
    .eq("id", params.id)
    .single();
  if (!ticket || ticket.user_id !== user.id) redirect("/dashboard/support");

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

  const resolved = ticket.status === "resolved";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>
      <div>
        <h1 className="font-sora text-xl font-semibold">{ticket.subject as string}</h1>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">
          {(ticket.status as string).replace("_", " ")}
        </p>
      </div>

      <div className="card-surface p-5">
        <LiveSupportThread ticketId={ticket.id as string} initialMessages={messages} />
      </div>

      {resolved ? (
        <p className="text-sm text-muted-foreground">
          This ticket is resolved. Open a new ticket if you need more help.
        </p>
      ) : (
        <SupportReply ticketId={ticket.id as string} />
      )}
    </div>
  );
}
