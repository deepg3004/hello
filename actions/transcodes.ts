"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";

interface Result {
  ok: boolean;
  message?: string;
}

const VIDEO_BUCKET = "course-media";

/** Re-enqueue a failed HLS transcode. Only works while the raw upload still
 *  exists (the raw is deleted after a successful transcode). Admin only. */
export async function retryTranscodeAction(rawPath: string): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return { ok: false, message: "Admin only" };
  }

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("hls_assets")
    .select("raw_path")
    .eq("raw_path", rawPath)
    .maybeSingle();
  if (!asset) return { ok: false, message: "Asset not found" };

  // The raw upload must still be present to re-transcode.
  const slash = rawPath.lastIndexOf("/");
  const dir = rawPath.slice(0, slash);
  const file = rawPath.slice(slash + 1);
  const { data: listed } = await admin.storage.from(VIDEO_BUCKET).list(dir, { search: file });
  if (!(listed ?? []).some((f) => f.name === file)) {
    return {
      ok: false,
      message: "The raw upload is gone (deleted after a successful transcode). Re-upload the video.",
    };
  }

  await admin
    .from("hls_assets")
    .update({ status: "processing", error: null, updated_at: new Date().toISOString() })
    .eq("raw_path", rawPath);

  const { enqueueHlsJob } = await import("@/lib/queues/hls");
  await enqueueHlsJob(rawPath);

  await writeAuditLog({
    admin_id: adminId,
    action: "transcode.retry",
    target_type: "hls_asset",
    target_id: rawPath,
  });

  revalidatePath("/admin/transcodes");
  return { ok: true };
}
