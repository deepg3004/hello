import { describe, expect, it } from "vitest";

import {
  eventSupportsChannel,
  isChannelEnabled,
  isEmailEventEnabled,
  isEventEnabled,
  type NotificationsConfig,
} from "@/lib/notifications-config";

describe("notification channel preferences", () => {
  it("defaults: in-app + email ON, sms OFF, whatsapp gated by master", () => {
    const cfg: NotificationsConfig | null = null;
    expect(isChannelEnabled(cfg, "inapp", "new_sale")).toBe(true);
    expect(isChannelEnabled(cfg, "email", "new_sale")).toBe(true);
    expect(isChannelEnabled(cfg, "sms", "new_sale")).toBe(false);
    // No config => master off => whatsapp off
    expect(isChannelEnabled(cfg, "whatsapp", "new_sale")).toBe(false);
  });

  it("whatsapp requires the master switch even when the event toggle is on", () => {
    const cfg: NotificationsConfig = {
      enabled: false,
      events: { new_sale: true },
    };
    expect(isChannelEnabled(cfg, "whatsapp", "new_sale")).toBe(false);

    const on: NotificationsConfig = { enabled: true, events: { new_sale: true } };
    expect(isChannelEnabled(on, "whatsapp", "new_sale")).toBe(true);
  });

  it("respects explicit per-channel opt-outs and opt-ins", () => {
    const cfg: NotificationsConfig = {
      enabled: true,
      email: { new_sale: false },
      inapp: { payment_failed: false },
      sms: { new_sale: true },
    };
    expect(isChannelEnabled(cfg, "email", "new_sale")).toBe(false);
    expect(isChannelEnabled(cfg, "inapp", "payment_failed")).toBe(false);
    expect(isChannelEnabled(cfg, "sms", "new_sale")).toBe(true);
    // Untouched events keep their defaults
    expect(isChannelEnabled(cfg, "inapp", "new_lead")).toBe(true);
    expect(isChannelEnabled(cfg, "sms", "new_lead")).toBe(false);
  });

  it("back-compat shims delegate to isChannelEnabled", () => {
    const cfg: NotificationsConfig = { enabled: true, events: { new_sale: true } };
    expect(isEventEnabled(cfg, "new_sale")).toBe(true);
    expect(isEmailEventEnabled(cfg, "new_sale")).toBe(true);
  });

  it("registry: new_sale excludes in-app (covered by payment_received bell)", () => {
    expect(eventSupportsChannel("new_sale", "inapp")).toBe(false);
    expect(eventSupportsChannel("new_sale", "email")).toBe(true);
    expect(eventSupportsChannel("new_sale", "whatsapp")).toBe(true);
    expect(eventSupportsChannel("new_sale", "sms")).toBe(true);
    // new_lead has no email channel (lead endpoint sends its own)
    expect(eventSupportsChannel("new_lead", "email")).toBe(false);
    expect(eventSupportsChannel("new_lead", "inapp")).toBe(true);
  });
});
