// Order risk scoring — runs at checkout, AFTER the pending order is persisted.
// It looks at recent order history for velocity / duplicate signals plus the
// order amount, sums weighted signals into a score, and (if the score crosses
// the configured threshold) flags the order for admin review and pings admins.
//
// Flagging NEVER blocks a payment — it is purely a review aid. The blocklist
// (lib/risk/blocklist) is the only hard gate. Everything here is best-effort.

import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { notifyAdmins } from "@/lib/notifications/create";

export interface RiskThresholds {
  velocityEmailPerHour: number;
  velocityIpPerHour: number;
  highValueInr: number;
  duplicateWindowMin: number;
  flagThreshold: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  velocityEmailPerHour: 6,
  velocityIpPerHour: 8,
  highValueInr: 25000,
  duplicateWindowMin: 10,
  flagThreshold: 2,
};

export interface RiskFlag {
  code: "velocity_email" | "velocity_ip" | "duplicate" | "high_value";
  label: string;
  weight: number;
}

// Catalog of signals and how heavily each counts toward the score.
const FLAG_WEIGHTS: Record<RiskFlag["code"], number> = {
  duplicate: 2,
  velocity_email: 2,
  velocity_ip: 1,
  high_value: 1,
};

export interface RiskSignals {
  emailOrdersLastHour: number;
  ipOrdersLastHour: number;
  duplicateRecently: boolean;
  amountInr: number;
}

export interface RiskVerdict {
  score: number;
  flags: RiskFlag[];
  flagged: boolean;
}

/**
 * Pure scorer — no IO, fully unit-testable. Turns raw signals + thresholds into
 * a weighted score and the list of tripped flags.
 */
export function scoreOrderRisk(
  signals: RiskSignals,
  thresholds: RiskThresholds,
): RiskVerdict {
  const flags: RiskFlag[] = [];
  const push = (code: RiskFlag["code"], label: string) =>
    flags.push({ code, label, weight: FLAG_WEIGHTS[code] });

  if (signals.duplicateRecently)
    push("duplicate", `Duplicate order within ${thresholds.duplicateWindowMin} min`);
  if (signals.emailOrdersLastHour > thresholds.velocityEmailPerHour)
    push("velocity_email", `${signals.emailOrdersLastHour} orders from this email in 1h`);
  if (signals.ipOrdersLastHour > thresholds.velocityIpPerHour)
    push("velocity_ip", `${signals.ipOrdersLastHour} orders from this IP in 1h`);
  if (signals.amountInr >= thresholds.highValueInr)
    push("high_value", `High value: ₹${signals.amountInr.toLocaleString("en-IN")}`);

  const score = flags.reduce((s, f) => s + f.weight, 0);
  return { score, flags, flagged: score >= thresholds.flagThreshold };
}

async function loadThresholds(): Promise<RiskThresholds> {
  const num = async (key: string, fallback: number) => {
    const raw = await getSetting(key, "");
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    velocityEmailPerHour: await num("risk_velocity_email_per_hour", DEFAULT_THRESHOLDS.velocityEmailPerHour),
    velocityIpPerHour: await num("risk_velocity_ip_per_hour", DEFAULT_THRESHOLDS.velocityIpPerHour),
    highValueInr: await num("risk_high_value_inr", DEFAULT_THRESHOLDS.highValueInr),
    duplicateWindowMin: await num("risk_duplicate_window_min", DEFAULT_THRESHOLDS.duplicateWindowMin),
    flagThreshold: await num("risk_flag_threshold", DEFAULT_THRESHOLDS.flagThreshold),
  };
}

export interface EvaluateInput {
  orderId: string;
  sellerUserId: string;
  email: string;
  ip: string | null;
  amountInr: number;
  productId: string | null;
}

/**
 * Gather recent-history signals for an order, score it, and persist a flag +
 * notify admins when it crosses the threshold. Fire-and-forget; never throws.
 */
export async function evaluateAndFlagOrder(input: EvaluateInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const thresholds = await loadThresholds();

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dupWindow = new Date(
      Date.now() - thresholds.duplicateWindowMin * 60 * 1000,
    ).toISOString();

    // Velocity by email (exclude the order we just inserted).
    const emailQ = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_email", input.email)
      .gte("created_at", hourAgo)
      .neq("id", input.orderId);

    // Velocity by IP.
    const ipQ = input.ip
      ? await admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", input.ip)
          .gte("created_at", hourAgo)
          .neq("id", input.orderId)
      : { count: 0 };

    // Duplicate: same email + product + amount in the recent window.
    const dupQ = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_email", input.email)
      .eq("product_id", input.productId)
      .eq("amount", input.amountInr)
      .gte("created_at", dupWindow)
      .neq("id", input.orderId);

    const verdict = scoreOrderRisk(
      {
        emailOrdersLastHour: emailQ.count ?? 0,
        ipOrdersLastHour: ipQ.count ?? 0,
        duplicateRecently: (dupQ.count ?? 0) > 0,
        amountInr: input.amountInr,
      },
      thresholds,
    );

    if (verdict.score === 0) return; // nothing to record

    await admin
      .from("orders")
      .update({
        risk_score: verdict.score,
        risk_flags: verdict.flags,
        ...(verdict.flagged
          ? { review_status: "flagged", flagged_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", input.orderId);

    if (verdict.flagged) {
      await notifyAdmins({
        type: "order_flagged",
        title: "⚠️ Order flagged for review",
        body: `₹${input.amountInr.toLocaleString("en-IN")} from ${input.email} — ${verdict.flags
          .map((f) => f.label)
          .join("; ")}`,
        link: "/admin/risk",
        meta: { order_id: input.orderId, score: verdict.score },
      });
    }
  } catch (e) {
    console.error("[risk] evaluateAndFlagOrder failed", e);
  }
}
