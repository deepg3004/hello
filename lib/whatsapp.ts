// Thin compatibility wrapper around lib/twilio. The richer API lives there.
//
// This file used to talk to MSG91 directly and is no longer imported anywhere
// in the codebase, but we keep it as a thin Twilio passthrough so any future
// import doesn't accidentally bring back the old MSG91 dependency.

import {
  sendWhatsApp as twilioSendWhatsApp,
  type WaResult as TwilioWaResult,
} from "@/lib/twilio";

export interface WaSendArgs {
  to: string;                          // E.164 phone (with country code, +91...)
  template_name?: string;              // when sending an approved template
  body?: string;                       // for session messages (sandbox / 24h window)
  /** Variables to substitute into the template, in order. */
  variables?: string[];
}

export type WaResult = TwilioWaResult;

export async function sendWhatsApp(args: WaSendArgs): Promise<WaResult> {
  if (args.template_name) {
    return twilioSendWhatsApp(args.to, args.template_name, args.variables ?? []);
  }
  // Freeform body — Twilio backend uses the template_id fallback formatter
  // for unknown names. We pass a synthetic name + the body as variable 0,
  // and the fallback default just concatenates vars.
  return twilioSendWhatsApp(args.to, "__FREEFORM__", [args.body ?? ""]);
}
