import { notFound, redirect } from "next/navigation";

import { PlansEditor } from "@/components/dashboard/telegram/PlansEditor";
import { getChannelPlansAction } from "@/actions/telegram-channels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit plans" };

export default async function EditPlansPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const res = await getChannelPlansAction(params.id);
  if (!res.ok || !res.data) notFound();

  return (
    <PlansEditor
      groupDbId={params.id}
      groupName={res.data.groupName}
      initialPlans={res.data.plans}
      initialAutoRenewal={res.data.autoRenewal}
      initialPublished={res.data.published}
      initialOfferEndsAt={res.data.offerEndsAt}
      initialTheme={res.data.theme}
      initialBgAnimation={res.data.bgAnimation}
      initialLogoUrl={res.data.logoUrl}
      initialQuestions={res.data.checkoutQuestions}
      pageUrl={res.data.pageUrl}
    />
  );
}
