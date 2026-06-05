import { describe, expect, it } from "vitest";

import {
  MAILBOX_ROLES,
  TEMPLATE_ROLE,
  smtpKey,
  type TemplateKey,
} from "@/lib/emails/routing";

const ALL_TEMPLATES: TemplateKey[] = [
  "order_confirmation",
  "payment_failed",
  "welcome",
  "subscription_renewal",
  "abandoned_recovery_1",
  "abandoned_recovery_2",
  "lead_notification",
];

describe("smtpKey", () => {
  it("builds the platform_settings key for a mailbox field", () => {
    expect(smtpKey("kyc", "pass")).toBe("smtp_kyc_pass");
    expect(smtpKey("buyer", "user")).toBe("smtp_buyer_user");
    expect(smtpKey("noreply", "reply_to")).toBe("smtp_noreply_reply_to");
  });
});

describe("MAILBOX_ROLES", () => {
  it("contains the distinct audience mailboxes", () => {
    expect(new Set(MAILBOX_ROLES).size).toBe(MAILBOX_ROLES.length);
    expect(MAILBOX_ROLES).toEqual([
      "kyc",
      "seller",
      "buyer",
      "support",
      "noreply",
      "onboarding",
      "billing",
      "legal",
    ]);
  });
});

describe("TEMPLATE_ROLE", () => {
  it("maps every template to a known mailbox role", () => {
    for (const [template, role] of Object.entries(TEMPLATE_ROLE)) {
      expect(MAILBOX_ROLES, `${template} → ${role}`).toContain(role);
    }
  });

  it("covers every template key exactly once (exhaustive)", () => {
    expect(Object.keys(TEMPLATE_ROLE).sort()).toEqual([...ALL_TEMPLATES].sort());
  });

  it("routes onboarding, billing and seller mail to their mailboxes", () => {
    expect(TEMPLATE_ROLE.welcome).toBe("onboarding");
    expect(TEMPLATE_ROLE.order_confirmation).toBe("billing");
    expect(TEMPLATE_ROLE.payment_failed).toBe("billing");
    expect(TEMPLATE_ROLE.subscription_renewal).toBe("billing");
    expect(TEMPLATE_ROLE.lead_notification).toBe("seller");
  });
});
