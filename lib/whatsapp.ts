// MSG91 WhatsApp send wrapper. Fail-soft when keys aren't set so callers can
// always treat WhatsApp delivery as best-effort.
//
// MSG91 docs: https://docs.msg91.com/whatsapp/send-message
// Endpoint used: https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message

export interface WaSendArgs {
  to: string;                          // E.164 phone (with country code, no +)
  template_name?: string;              // when sending an approved template
  body?: string;                       // for session messages
  /** Variables to substitute into the template, in order. */
  variables?: string[];
}

export interface WaResult {
  ok: boolean;
  id?: string;
  message?: string;
  skipped?: boolean;
}

export async function sendWhatsApp(args: WaSendArgs): Promise<WaResult> {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key) {
    console.warn("[whatsapp] MSG91_AUTH_KEY not set — skipping send", {
      to: args.to,
      template: args.template_name,
    });
    return { ok: true, skipped: true };
  }
  try {
    const payload = args.template_name
      ? {
          integrated_number: process.env.MSG91_WA_FROM ?? "",
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: args.template_name,
              language: { code: "en", policy: "deterministic" },
              namespace: process.env.MSG91_WA_NAMESPACE ?? "",
              to_and_components: [
                {
                  to: [args.to.replace(/^\+/, "")],
                  components: {
                    body_1: { type: "text", value: args.variables?.[0] ?? "" },
                    body_2: { type: "text", value: args.variables?.[1] ?? "" },
                    body_3: { type: "text", value: args.variables?.[2] ?? "" },
                  },
                },
              ],
            },
          },
        }
      : {
          integrated_number: process.env.MSG91_WA_FROM ?? "",
          content_type: "text",
          payload: {
            messaging_product: "whatsapp",
            type: "text",
            text: { body: args.body ?? "" },
            to: args.to.replace(/^\+/, ""),
          },
        };
    const res = await fetch(
      "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { "content-type": "application/json", authkey: key },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { request_id?: string };
    return { ok: true, id: json.request_id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
