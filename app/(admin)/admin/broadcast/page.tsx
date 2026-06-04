// Admin · Broadcast (Session 17) — post an in-app announcement (the bell) to
// every seller or admin. In-app only; no email blast. Admin-gated by layout.

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { BroadcastForm } from "@/components/admin/BroadcastForm";

export const metadata = { title: "Admin · Broadcast" };

export default function AdminBroadcastPage() {
  return (
    <div className="space-y-6">
      <DashboardHero
        title="Broadcast"
        blurb="Send an in-app announcement to every seller (or every admin). It lands in their notification bell — no email is sent."
        resourcesHref={null}
      />
      <BroadcastForm />
    </div>
  );
}
