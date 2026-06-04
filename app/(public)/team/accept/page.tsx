// /team/accept?token=…&id=… — Team invite acceptance (Session 15).
// Requires login. If signed out, bounce to /login and come back. Once signed
// in, a one-click accept links the membership and drops the user into the
// account they joined.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AcceptInvite } from "@/components/team/AcceptInvite";

export const metadata = { title: "Accept team invite" };
export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string; id?: string };
}) {
  const token = searchParams.token ?? "";
  const id = searchParams.id ?? "";

  const self = `/team/accept?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(self)}`);

  if (!token || !id) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-sora text-xl font-semibold">Invalid invite link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is missing information. Ask the account owner to re-send it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-sora text-2xl font-semibold">Join the team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re signed in as <strong>{user.email}</strong>. Accept to join
        this account — make sure this is the email the invite was sent to.
      </p>
      <div className="mt-6">
        <AcceptInvite token={token} id={id} />
      </div>
    </div>
  );
}
