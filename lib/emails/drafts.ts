// Editable starter content for each built-in template — what the admin editor
// pre-fills when a template hasn't been overridden yet. These are intentionally
// simple placeholder versions; the admin customises from here. (Sending still
// uses the richer code template until an override is saved.)

export interface Draft {
  subject: string;
  body_html: string;
}

const btn = (url: string, label: string) =>
  `<p style="margin:18px 0"><a href="${url}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:#6D28D9;color:#ffffff;font-weight:600;text-decoration:none">${label}</a></p>`;

export const DEFAULT_DRAFT: Record<string, Draft> = {
  welcome: {
    subject: "Welcome to {{brand_name}}!",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Welcome 👋</h2>
<p>Hi {{seller_name}},</p>
<p>Your {{brand_name}} account is ready. Add a product, share your page, and start taking payments.</p>
${btn("{{app_url}}/dashboard", "Open dashboard")}`,
  },
  order_confirmation: {
    subject: "Receipt — {{product_name}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Thanks for your purchase 🎉</h2>
<p>Hi {{buyer_name}},</p>
<p>Your payment of ₹{{amount}} for <strong>{{product_name}}</strong> was successful.</p>
${btn("{{invoice_url}}", "Download invoice")}`,
  },
  payment_failed: {
    subject: "Payment failed — please try again",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Payment didn't go through</h2>
<p>Hi {{buyer_name}},</p>
<p>Your payment of ₹{{amount}} for {{product_name}} failed ({{reason}}). You can try again below.</p>
${btn("{{retry_url}}", "Try again")}`,
  },
  subscription_renewal: {
    subject: "Your {{plan}} plan renews soon",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Subscription renewal</h2>
<p>Hi {{seller_name}},</p>
<p>Your {{plan}} plan (₹{{amount}}) renews on {{renews_at}}.</p>
${btn("{{app_url}}/dashboard/settings/billing", "Manage plan")}`,
  },
  lead_notification: {
    subject: "New lead from {{page_title}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">New lead captured</h2>
<p>Hi {{seller_name}},</p>
<p>{{lead_name}} ({{lead_email}}, {{lead_phone}}) signed up via {{page_title}}.</p>
${btn("{{app_url}}/dashboard/leads", "Open CRM")}`,
  },
  abandoned_recovery_1: {
    subject: "You left something behind",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Almost yours</h2>
<p>Hi {{buyer_name}},</p>
<p>You were one click away from buying <strong>{{product_name}}</strong> (₹{{product_price}}). We saved your cart.</p>
${btn("{{recovery_url}}", "Complete your purchase")}`,
  },
  abandoned_recovery_2: {
    subject: "{{coupon_label}} — {{product_name}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Still thinking it over?</h2>
<p>Hi {{buyer_name}},</p>
<p>Here's {{coupon_label}} (code <strong>{{coupon_code}}</strong>) to finish your order for {{product_name}}.</p>
${btn("{{recovery_url}}", "Use coupon now")}`,
  },
  sale_receipt: {
    subject: "Receipt — {{productName}} (₹{{amountInr}})",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Thanks for your purchase 🎉</h2>
<p>Hi {{buyerName}},</p>
<p>Your payment for <strong>{{productName}}</strong> from {{sellerLegalName}} (₹{{amountInr}}) was successful. Order {{orderId}}.</p>
${btn("{{invoiceUrl}}", "Download GST invoice")}`,
  },
  telegram_invite: {
    subject: "Your invite to {{groupName}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Welcome 👋</h2>
<p>Hi {{buyerName}},</p>
<p>Tap below to join <strong>{{groupName}}</strong> on Telegram. The link is for you only and expires in 10 minutes.</p>
${btn("{{inviteLink}}", "Open in Telegram")}`,
  },
  telegram_expiry: {
    subject: "Your access to {{groupName}} has expired",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Your VIP access has expired</h2>
<p>Hi {{buyerName}},</p>
<p>Your access to <strong>{{groupName}}</strong> ran out and you've been removed. Renew to get a fresh invite.</p>
${btn("{{renewUrl}}", "Renew access")}`,
  },
  telegram_reminder: {
    subject: "{{daysLeft}} days left — {{groupName}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Your VIP access ends soon</h2>
<p>Hi {{buyerName}},</p>
<p>Your access to <strong>{{groupName}}</strong> ends in {{daysLeft}} days. Renew now to stay in.</p>
${btn("{{renewUrl}}", "Renew now")}`,
  },
  lead_confirmation: {
    subject: "Thanks for signing up — {{pageTitle}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">You're in</h2>
<p>Hi {{leadName}},</p>
<p>{{body}}</p>`,
  },
  lead_magnet: {
    subject: "Your download — {{pageTitle}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Here's your download</h2>
<p>Hi {{leadName}},</p>
<p>Tap below to grab your file.</p>
${btn("{{downloadUrl}}", "Download now")}`,
  },
  lead_alert: {
    subject: "New lead from {{pageTitle}}",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">New lead captured</h2>
<p>Hi {{sellerName}},</p>
<p>{{leadName}} — {{leadEmail}} ({{leadPhone}}) signed up via {{pageTitle}}.</p>
${btn("{{app_url}}/dashboard/leads", "Open CRM")}`,
  },
  recovery_1: {
    subject: "You left something behind",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Almost yours</h2>
<p>Hi {{buyerName}},</p>
<p>You were one click away from buying <strong>{{productName}}</strong> (₹{{productPrice}}) from {{sellerName}}.</p>
${btn("{{recoveryUrl}}", "Complete your purchase")}`,
  },
  recovery_2: {
    subject: "Still thinking it over?",
    body_html: `<h2 style="margin:0 0 12px;font-size:20px">Last chance</h2>
<p>Hi {{buyerName}},</p>
<p>Use code <strong>{{couponCode}}</strong> ({{couponLabel}}) to finish your order for {{productName}}.</p>
${btn("{{recoveryUrl}}", "Complete your purchase")}`,
  },
};
