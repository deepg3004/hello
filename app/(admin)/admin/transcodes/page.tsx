// Admin · Video DRM — visibility into course-video HLS transcoding. Spot failed
// transcodes (which silently fall back to the signed-URL stream) and retry them.
// Gated by the (admin) layout (is_admin).

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminTranscodesClient,
  type TranscodeRow,
} from "@/components/admin/AdminTranscodesClient";

export const metadata = { title: "Admin · Video DRM" };
export const dynamic = "force-dynamic";

export default async function AdminTranscodesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hls_assets")
    .select("raw_path, status, seg_count, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows: TranscodeRow[] = ((data ?? []) as Array<{
    raw_path: string;
    status: string;
    seg_count: number | null;
    error: string | null;
    created_at: string;
    updated_at: string | null;
  }>).map((r) => ({
    rawPath: r.raw_path,
    status: r.status,
    segCount: r.seg_count,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const counts = {
    processing: rows.filter((r) => r.status === "processing").length,
    ready: rows.filter((r) => r.status === "ready").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Video DRM"
        blurb="Course videos transcode to AES-128 encrypted HLS in the background. Failed transcodes fall back to the signed-URL stream — retry them here."
        gradient="from-slate-700 via-zinc-700 to-neutral-800"
        resourcesHref={null}
      />
      <AdminTranscodesClient rows={rows} counts={counts} />
    </div>
  );
}
