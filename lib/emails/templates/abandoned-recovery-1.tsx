import { SHELL, ctaButton, escapeHtml } from "../layout";

export interface RecoveryHero {
  buyer_name?: string | null;
  seller_name?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  product_price?: number | null;
  recovery_url: string;
}

function hero(args: RecoveryHero, kicker: string): string {
  const price =
    args.product_price == null
      ? ""
      : `₹${args.product_price.toLocaleString("en-IN")}`;
  return `
    <p style="margin:0 0 12px;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:1.4px">${escapeHtml(
      kicker,
    )}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 18px">
      <tr>
        ${
          args.product_image
            ? `<td style="width:88px;padding-right:14px;vertical-align:top"><img src="${args.product_image}" width="88" height="88" style="display:block;border-radius:8px;border:1px solid #e4e4e7;object-fit:cover" alt="" /></td>`
            : ""
        }
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#18181b">${escapeHtml(args.product_name ?? "Your purchase")}</p>
          ${price ? `<p style="margin:0;color:#52525b;font-size:13px">${price}</p>` : ""}
          <p style="margin:8px 0 0;color:#71717a;font-size:12px">from ${escapeHtml(args.seller_name ?? "the seller")}</p>
        </td>
      </tr>
    </table>
  `;
}

export function abandonedRecovery1Email(args: RecoveryHero): {
  subject: string;
  html: string;
} {
  const hello = args.buyer_name ? `Hi ${args.buyer_name},` : "Hi,";
  const subject = args.buyer_name
    ? `You left something behind, ${args.buyer_name}`
    : "You left something behind";
  return {
    subject,
    html: SHELL(
      `
      ${hero(args, "Almost yours")}
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">
        You were one click away from buying <strong>${escapeHtml(args.product_name ?? "your purchase")}</strong>.
        We saved your cart — pick up where you left off below.
      </p>
      ${ctaButton(args.recovery_url, "Complete your purchase →")}
      <p style="margin:0;color:#a1a1aa;font-size:11px">If the button doesn't work: <span style="color:#52525b">${args.recovery_url}</span></p>
      `,
      { preheader: "We saved your cart — finish your order." },
    ),
  };
}
