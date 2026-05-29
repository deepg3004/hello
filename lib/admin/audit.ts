// Audit log helper — append-only writes to admin_audit_logs.
// Used by every admin server action so every privileged change is traceable.

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEntry {
  admin_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  let ip: string | null = null;
  try {
    const fwd = headers().get("x-forwarded-for");
    ip = fwd?.split(",")[0]?.trim() ?? null;
  } catch {
    /* headers() unavailable in some contexts */
  }
  await admin.from("admin_audit_logs").insert({
    admin_id: entry.admin_id,
    action: entry.action,
    target_type: entry.target_type ?? null,
    target_id: entry.target_id ?? null,
    details: entry.details ?? null,
    ip_address: ip,
  });
}

/**
 * Verify the current session belongs to an admin. Returns the admin user id
 * or throws.
 */
export async function requireAdmin(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Admin only");
  return user.id;
}
