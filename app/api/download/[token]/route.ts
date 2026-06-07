// GET /api/download/<token> — redirects a paying buyer to a short-lived signed
// URL for their purchased digital file, counting one download against the
// per-buyer limit (atomic via consume_download_grant). Token-based: no login
// needed (the token is the secret).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { signedDownloadUrl } from "@/lib/downloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Grant {
  file_url: string;
  file_name: string | null;
  download_limit: number | null;
  downloads_used: number;
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  const admin = createAdminClient();

  const { data: grant } = await admin
    .from("download_grants")
    .select("file_url, file_name, download_limit, downloads_used")
    .eq("token", token)
    .maybeSingle<Grant>();
  if (!grant) {
    return new NextResponse("This download link is invalid.", { status: 404 });
  }
  if (grant.download_limit != null && grant.downloads_used >= grant.download_limit) {
    return new NextResponse("Download limit reached for this purchase.", { status: 403 });
  }

  // Sign BEFORE consuming so a signing failure doesn't burn a download.
  const url = await signedDownloadUrl(grant.file_url, grant.file_name, admin);
  if (!url) {
    return new NextResponse("This file is currently unavailable.", { status: 500 });
  }

  // Atomically consume one download (guards against the concurrent-last-download
  // race; returns null if another request just hit the limit).
  const { data: consumed } = await admin.rpc("consume_download_grant", { p_token: token });
  if (!consumed) {
    return new NextResponse("Download limit reached for this purchase.", { status: 403 });
  }

  return NextResponse.redirect(url, 302);
}
