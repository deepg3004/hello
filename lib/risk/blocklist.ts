// Risk blocklist — an admin-managed denylist of emails / IPs / phones that
// checkout and other entry points hard-block. All reads are best-effort and
// FAIL OPEN: if the lookup errors, we do not block a legitimate buyer.

import { createAdminClient } from "@/lib/supabase/admin";

export type BlocklistKind = "email" | "ip" | "phone";

export interface BlockCheck {
  email?: string | null;
  ip?: string | null;
  phone?: string | null;
}

export interface BlockResult {
  blocked: boolean;
  kind?: BlocklistKind;
  value?: string;
  reason?: string | null;
}

/** Normalise a value the same way on write and on read so lookups match. */
export function normaliseBlock(kind: BlocklistKind, raw: string): string {
  const v = (raw ?? "").trim();
  if (kind === "email") return v.toLowerCase();
  if (kind === "phone") return v.replace(/[^0-9]/g, ""); // digits only
  return v; // ip stored verbatim
}

/**
 * Returns whether any of the supplied identifiers is on the active blocklist.
 * Short-circuits on the first match. Never throws.
 */
export async function isBlocked(check: BlockCheck): Promise<BlockResult> {
  const pairs: Array<{ kind: BlocklistKind; value: string }> = [];
  if (check.email) pairs.push({ kind: "email", value: normaliseBlock("email", check.email) });
  if (check.ip) pairs.push({ kind: "ip", value: normaliseBlock("ip", check.ip) });
  if (check.phone) pairs.push({ kind: "phone", value: normaliseBlock("phone", check.phone) });
  if (pairs.length === 0) return { blocked: false };

  try {
    const admin = createAdminClient();
    // One round-trip: match any (kind,value) pair that is active.
    const { data, error } = await admin
      .from("risk_blocklist")
      .select("kind, value, reason")
      .eq("active", true)
      .in(
        "value",
        pairs.map((p) => p.value),
      );
    if (error || !data) return { blocked: false };

    for (const p of pairs) {
      const hit = data.find((r) => r.kind === p.kind && r.value === p.value);
      if (hit) {
        return {
          blocked: true,
          kind: hit.kind as BlocklistKind,
          value: hit.value,
          reason: hit.reason ?? null,
        };
      }
    }
    return { blocked: false };
  } catch (e) {
    console.error("[risk] isBlocked failed (failing open)", e);
    return { blocked: false };
  }
}

export interface BlocklistEntry {
  id: string;
  kind: BlocklistKind;
  value: string;
  reason: string | null;
  active: boolean;
  created_at: string;
}

/** Upsert a blocklist rule (re-activates an existing kind+value). */
export async function addBlocklistEntry(input: {
  kind: BlocklistKind;
  value: string;
  reason?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const value = normaliseBlock(input.kind, input.value);
  if (!value) return { ok: false, message: "Value is required" };
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("risk_blocklist").upsert(
      {
        kind: input.kind,
        value,
        reason: input.reason ?? null,
        active: true,
        created_by: input.createdBy ?? null,
      },
      { onConflict: "kind,value" },
    );
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Deactivate (soft-remove) a blocklist rule by id. */
export async function removeBlocklistEntry(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("risk_blocklist")
      .update({ active: false })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function listBlocklist(): Promise<BlocklistEntry[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("risk_blocklist")
      .select("id, kind, value, reason, active, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(500);
    return (data as BlocklistEntry[] | null) ?? [];
  } catch {
    return [];
  }
}
