// =============================================================================
// InvoxAI — domain types
//
// These mirror the Supabase tables we will create next. Money is stored in the
// smallest currency unit (paise for INR) to avoid float drift. All timestamp
// fields are ISO 8601 strings as returned by Supabase.
// =============================================================================

export type ISODateTime = string;
export type UUID = string;

// -- Enums --------------------------------------------------------------------

export type UserRole = "seller" | "admin" | "support";
export type KYCStatus = "unverified" | "pending" | "verified" | "rejected";

export type PageKind =
  | "payment"
  | "landing"
  | "telegram"
  | "checkout"
  | "thankyou";
export type PageStatus = "draft" | "published" | "archived";

export type ProductKind =
  | "one_time"
  | "subscription"
  | "telegram_access"
  | "digital_download";

export type OrderStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type TransactionKind =
  | "charge"
  | "refund"
  | "payout"
  | "commission"
  | "adjustment";
export type TransactionStatus =
  | "initiated"
  | "processing"
  | "succeeded"
  | "failed";

export type PayoutStatus =
  | "queued"
  | "processing"
  | "paid"
  | "failed"
  | "on_hold";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "paused"
  | "expired";

export type CouponKind = "percent" | "flat";

export type TelegramMemberStatus =
  | "invited"
  | "joined"
  | "active"
  | "expired"
  | "kicked";

// -- User ---------------------------------------------------------------------

export interface User {
  id: UUID; // matches auth.users.id
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  business_name: string | null;
  business_slug: string | null; // unique handle, e.g. for *.invoxai.io
  kyc_status: KYCStatus;
  default_currency: string; // ISO 4217, e.g. "INR"
  commission_percent_override: number | null; // overrides PLATFORM_COMMISSION_PERCENT
  payout_account_id: string | null; // Razorpay fund account id
  onboarded_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// -- Page (builder output) ----------------------------------------------------

export interface Page {
  id: UUID;
  user_id: UUID;
  kind: PageKind;
  status: PageStatus;
  slug: string; // unique within the seller scope, e.g. /p/{slug}
  title: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  thumbnail_url: string | null;
  schema: PageSchema; // JSONB — the block tree the renderer reads
  primary_product_id: UUID | null;
  telegram_group_id: UUID | null;
  views: number;
  published_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PageBlock {
  id: string;
  type: string; // "hero" | "text" | "cta" | "pricing" | "faq" | ...
  props: Record<string, unknown>;
  children?: PageBlock[];
}

export interface PageSchema {
  version: 1;
  blocks: PageBlock[];
  theme?: Record<string, unknown>;
}

// -- Product ------------------------------------------------------------------

export interface Product {
  id: UUID;
  user_id: UUID;
  kind: ProductKind;
  name: string;
  description: string | null;
  image_url: string | null;
  price_paise: number;
  compare_at_price_paise: number | null;
  currency: string;
  is_active: boolean;
  inventory: number | null; // null = unlimited
  metadata: Record<string, unknown>;
  // subscription-specific
  billing_interval: "day" | "week" | "month" | "year" | null;
  billing_interval_count: number | null;
  trial_days: number | null;
  // telegram-specific
  telegram_group_id: UUID | null;
  access_duration_days: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// -- Order --------------------------------------------------------------------

export interface Order {
  id: UUID;
  short_id: string; // human-shareable id, e.g. nanoid(10)
  user_id: UUID; // seller
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  product_id: UUID;
  page_id: UUID | null;
  coupon_id: UUID | null;
  status: OrderStatus;
  amount_paise: number; // gross paid by buyer
  commission_paise: number; // platform cut
  net_to_seller_paise: number; // amount_paise - commission_paise - fees_paise
  fees_paise: number; // gateway fees we absorb (or pass through)
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  metadata: Record<string, unknown>;
  paid_at: ISODateTime | null;
  refunded_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// -- Transaction (immutable ledger row) --------------------------------------

export interface Transaction {
  id: UUID;
  user_id: UUID;
  order_id: UUID | null;
  payout_id: UUID | null;
  kind: TransactionKind;
  status: TransactionStatus;
  amount_paise: number; // positive credit, negative debit (seller-frame)
  currency: string;
  gateway: "razorpay" | "manual" | "system";
  gateway_reference: string | null;
  description: string | null;
  occurred_at: ISODateTime;
  created_at: ISODateTime;
}

// -- Payout -------------------------------------------------------------------

export interface Payout {
  id: UUID;
  user_id: UUID;
  amount_paise: number;
  currency: string;
  status: PayoutStatus;
  method: "bank_transfer" | "upi" | "manual";
  razorpay_payout_id: string | null;
  destination_last4: string | null;
  failure_reason: string | null;
  requested_at: ISODateTime;
  processed_at: ISODateTime | null;
  created_at: ISODateTime;
}

// -- Subscription -------------------------------------------------------------

export interface Subscription {
  id: UUID;
  user_id: UUID; // seller
  product_id: UUID;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  status: SubscriptionStatus;
  razorpay_subscription_id: string | null;
  current_period_start: ISODateTime | null;
  current_period_end: ISODateTime | null;
  trial_end: ISODateTime | null;
  cancel_at: ISODateTime | null;
  cancelled_at: ISODateTime | null;
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// -- Coupon -------------------------------------------------------------------

export interface Coupon {
  id: UUID;
  user_id: UUID;
  code: string; // unique per seller
  kind: CouponKind;
  value: number; // percent (0-100) or flat paise
  is_active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  starts_at: ISODateTime | null;
  expires_at: ISODateTime | null;
  applies_to_product_id: UUID | null; // null = any
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// -- Telegram group + membership ---------------------------------------------

export interface TelegramGroup {
  id: UUID;
  user_id: UUID;
  title: string;
  invite_link: string | null;
  chat_id: string | null; // bot-discovered chat id
  bot_token_ref: string | null; // pointer to encrypted secret; never raw token
  is_active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface TelegramMember {
  id: UUID;
  telegram_group_id: UUID;
  order_id: UUID | null;
  subscription_id: UUID | null;
  telegram_user_id: string | null;
  buyer_email: string;
  status: TelegramMemberStatus;
  invited_at: ISODateTime | null;
  joined_at: ISODateTime | null;
  expires_at: ISODateTime | null;
  created_at: ISODateTime;
}

// -- Lead capture -------------------------------------------------------------

export interface LeadCapture {
  id: UUID;
  user_id: UUID;
  page_id: UUID | null;
  email: string;
  name: string | null;
  phone: string | null;
  source: string | null; // referrer or utm_source
  utm: Record<string, string> | null;
  metadata: Record<string, unknown>;
  created_at: ISODateTime;
}

// -- Abandoned checkout -------------------------------------------------------

export interface AbandonedCheckout {
  id: UUID;
  user_id: UUID;
  page_id: UUID | null;
  product_id: UUID | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount_paise: number;
  currency: string;
  recovery_token: string; // signed token used in recovery email
  recovered_order_id: UUID | null;
  reminder_count: number;
  last_reminded_at: ISODateTime | null;
  expires_at: ISODateTime;
  created_at: ISODateTime;
}
