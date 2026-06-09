import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  SequencesManager,
  type SequenceWithSteps,
} from "@/components/dashboard/SequencesManager";

export const metadata = { title: "Email Sequences" };
export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const ctx = await requirePageActor("marketing.view", "/dashboard/marketing/sequences");
  const admin = createAdminClient();

  const { data: seqs } = await admin
    .from("email_sequences")
    .select("id, name, trigger, active")
    .eq("user_id", ctx.ownerId)
    .order("created_at", { ascending: false });
  const list = (seqs ?? []) as Array<{ id: string; name: string; trigger: string; active: boolean }>;

  const ids = list.map((s) => s.id);
  const { data: stepsRaw } = ids.length
    ? await admin
        .from("email_sequence_steps")
        .select("sequence_id, step_order, delay_hours, subject, body")
        .in("sequence_id", ids)
        .order("step_order", { ascending: true })
    : { data: [] as Array<{ sequence_id: string; delay_hours: number; subject: string; body: string }> };
  const steps = (stepsRaw ?? []) as Array<{ sequence_id: string; delay_hours: number; subject: string; body: string }>;

  const initial: SequenceWithSteps[] = list.map((s) => ({
    ...s,
    trigger: s.trigger as SequenceWithSteps["trigger"],
    steps: steps
      .filter((x) => x.sequence_id === s.id)
      .map((x) => ({ delay_hours: x.delay_hours, subject: x.subject, body: x.body })),
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Email Sequences"
        blurb="Automated drip emails — welcome new leads, onboard buyers, win back the rest. Use {{name}} and {{email}} in your copy."
        resourcesHref={null}
      />
      <SequencesManager initial={initial} />
    </div>
  );
}
