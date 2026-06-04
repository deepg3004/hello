import { notFound, redirect } from "next/navigation";

import { PlansEditor } from "@/components/dashboard/telegram/PlansEditor";
import { getChannelPlansAction } from "@/actions/telegram-channels";
import { requirePageActor } from "@/lib/account-context";

export const metadata = { title: "Edit plans" };

export default async function EditPlansPage({ params }: { params: { id: string } }) {
  const ctx = await requirePageActor("telegram.view", "/dashboard/telegram");

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
