import Link from "next/link";
import { cookies } from "next/headers";
import { Home, LogIn, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/Confetti";
import { PaymentSuccessShare } from "@/components/pages/PaymentSuccessShare";
import { ContactSellerButton } from "@/components/buyer/ContactSellerButton";
import { RequestRefundButton } from "@/components/buyer/RequestRefundButton";
import { TelegramInviteCard } from "@/components/pages/TelegramInviteCard";
import { PurchaseBeacon } from "@/components/tracking/PurchaseBeacon";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseForProduct } from "@/lib/courses";
import { signCourseToken } from "@/lib/course-token";
import { signContentToken } from "@/lib/content-token";
import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { publicPageUrl } from "@/lib/page-url";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

/** Mask an email for display when the viewer isn't the verified owner. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const head = user.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

interface OrderRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  buyer_email: string;
  buyer_name: string | null;
  paid_at: string | null;
  created_at: string;
  product_id: string | null;
  telegram_invite_link: string | null;
  page_id: string | null;
  refund_request_status: string | null;
  seller_user_id: string | null;
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, seller_user_id, amount, currency, status, buyer_email, buyer_name, paid_at, created_at, product_id, telegram_invite_link, page_id, refund_request_status",
    )
    .eq("id", params.id)
    .single<OrderRow>();

  if (!order) {
    return <NotFoundShell />;
  }

  // OWNERSHIP: the order id (a UUID) alone must NOT expose buyer PII or grant
  // access tokens. The buyer is auto-signed-in after payment (verify-payment
  // sets the buyer cookie), so a matching buyer session proves ownership.
  // Non-owners get a redacted summary + a "sign in to access" prompt.
  const cookieStore = await cookies();
  const viewerEmail = verifyBuyerSession(cookieStore.get(BUYER_COOKIE)?.value ?? "");
  const owns =
    !!viewerEmail &&
    viewerEmail.toLowerCase() === (order.buyer_email ?? "").toLowerCase();

  // Cart orders carry line items instead of a single product.
  const { data: itemsRaw } = await admin
    .from("order_items")
    .select("name_snapshot, quantity, line_amount")
    .eq("order_id", order.id);
  const lineItems = (itemsRaw ?? []) as Array<{
    name_snapshot: string;
    quantity: number;
    line_amount: number;
  }>;

  // Pull product + page in parallel — small queries, both fail-soft.
  const [productResult, pageResult] = await Promise.all([
    order.product_id
      ? admin
          .from("products")
          .select("name")
          .eq("id", order.product_id)
          .single<{ name: string }>()
      : Promise.resolve({ data: null }),
    order.page_id
      ? admin
          .from("pages")
          .select(
            "slug, title, type, template_id, user_profiles!pages_user_id_fkey(full_name), telegram_vip_groups(group_name)",
          )
          .eq("id", order.page_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const productName = productResult.data?.name ?? "Your purchase";

  // Course unlocked by this product (if any) — buyers access via a signed link.
  const course = order.product_id
    ? await courseForProduct(order.product_id, admin)
    : null;
  // Only mint the access token for the verified owner — the token grants free
  // course access, so it must never render for a stranger holding the URL.
  const hasCourse = !!course && order.status === "paid";
  const courseHref =
    hasCourse && owns
      ? `/course/${course!.id}?t=${signCourseToken({
          course_id: course!.id,
          order_id: order.id,
          email: order.buyer_email,
        })}`
      : null;

  type PageJoin = {
    slug: string;
    title: string;
    type: string | null;
    template_id: string | null;
    user_profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    telegram_vip_groups:
      | { group_name: string | null }
      | { group_name: string | null }[]
      | null;
  };
  const page = (pageResult.data as PageJoin | null) ?? null;
  const seller = page
    ? Array.isArray(page.user_profiles)
      ? page.user_profiles[0]
      : page.user_profiles
    : null;
  const sellerName = seller?.full_name?.trim() || null;
  const pageSlug = page?.slug ?? null;
  const pageTitle = page?.title ?? null;
  const shareUrl = page?.slug
    ? publicPageUrl(page.type, page.slug, page.template_id)
    : null;

  // Lock Content pages unlock a private content page after payment.
  const hasUnlock =
    page?.template_id === "lock-content" &&
    order.status === "paid" &&
    !!order.page_id;
  const unlockHref =
    hasUnlock && owns
      ? `/unlock/${order.page_id}?t=${signContentToken({
          page_id: order.page_id!,
          order_id: order.id,
          email: order.buyer_email,
        })}`
      : null;

  const tg = page?.telegram_vip_groups
    ? Array.isArray(page.telegram_vip_groups)
      ? page.telegram_vip_groups[0]
      : page.telegram_vip_groups
    : null;
  const groupName = tg?.group_name ?? null;

  const paid = order.status === "paid";
  const failed =
    order.status === "failed" ||
    order.status === "cancelled" ||
    order.status === "expired";

  // A paid order with deliverables, viewed by someone who isn't signed in as the
  // buyer → prompt them to sign in rather than handing over access.
  const hasTelegram = paid && !!order.telegram_invite_link;
  const needsSignInForAccess =
    paid && !owns && (hasCourse || hasUnlock || hasTelegram);

  return (
    <main
      className={cn(
        "min-h-screen bg-gradient-to-b from-background to-background px-4 pt-12 md:py-16",
        paid ? "pb-28 md:pb-16" : "pb-12",
      )}
    >
      <div className="mx-auto max-w-xl space-y-6">
        {/* First-party Purchase event (server-confirmed paid order). */}
        {paid && order.seller_user_id && (
          <PurchaseBeacon
            sellerId={order.seller_user_id}
            orderId={order.id}
            value={Number(order.amount ?? 0)}
            currency={order.currency}
          />
        )}
        {/* Animated status circle */}
        {paid && <Confetti />}
        {paid && <StatusCircle variant="success" />}
        {failed && <StatusCircle variant="failure" />}
        {!paid && !failed && <StatusCircle variant="pending" />}

        {/* Heading + buyer line */}
        <div className="text-center">
          <h1 className="font-sora text-3xl font-bold tracking-tight text-foreground sm:text-[32px]">
            {paid
              ? "Payment Successful! 🎉"
              : failed
                ? "Payment Failed"
                : "Order Received"}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground sm:text-xl">
            {paid
              ? `Thank you${owns && order.buyer_name ? `, ${order.buyer_name}` : ""}`
              : failed
                ? "We couldn't capture this payment."
                : "Hold tight — confirmation is on its way."}
          </p>
        </div>

        {/* Order summary card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Order summary
          </p>
          <div className="mt-3 space-y-2.5">
            <KV
              label="Order ID"
              value={`#${order.id.slice(0, 8).toUpperCase()}`}
              mono
            />
            {lineItems.length > 0 ? (
              <div className="space-y-1.5 border-b border-border pb-2.5">
                {lineItems.map((it, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground">
                      {it.name_snapshot}
                      <span className="text-muted-foreground"> × {it.quantity}</span>
                    </span>
                    <span className="font-medium text-foreground">
                      ₹{Number(it.line_amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <KV label="Product" value={productName} />
            )}
            <KV
              label="Date"
              value={formatDateTime(order.paid_at ?? order.created_at)}
            />
            <KV label="Email" value={owns ? order.buyer_email : maskEmail(order.buyer_email)} />
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm font-medium text-foreground">
              {paid ? "Amount paid" : "Amount"}
            </span>
            <span
              className={
                "font-sora text-3xl font-bold " +
                (paid ? "text-emerald-600" : "text-foreground")
              }
            >
              ₹{Number(order.amount).toLocaleString("en-IN")}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {order.currency}
              </span>
            </span>
          </div>
        </div>

        {/* Course access — only when the product unlocks a course and paid */}
        {courseHref && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-sm">
            <p className="font-semibold text-indigo-200">🎓 Your course is ready</p>
            <p className="mt-1 text-indigo-300">
              Access <span className="font-medium">{course!.title}</span> any time
              from this link (bookmark it).
            </p>
            <Button asChild className="mt-3 bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href={courseHref}>Access your course →</Link>
            </Button>
          </div>
        )}

        {/* Lock Content — reveal the private content page after payment */}
        {unlockHref && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 text-sm">
            <p className="font-semibold text-violet-200">🔓 Your content is unlocked</p>
            <p className="mt-1 text-violet-300">
              Open your private content page any time from this link (bookmark it).
            </p>
            <Button asChild className="mt-3 bg-violet-600 text-white hover:bg-violet-700">
              <Link href={unlockHref}>Open your content →</Link>
            </Button>
          </div>
        )}

        {/* Telegram invite card — only for the verified owner (the invite link
            grants group access). */}
        {hasTelegram && owns && (
          <TelegramInviteCard
            inviteLink={order.telegram_invite_link!}
            groupName={groupName ?? "the VIP group"}
            buyerEmail={order.buyer_email}
          />
        )}

        {/* Not signed in as the buyer → prompt sign-in to reach the deliverables
            instead of exposing access tokens to anyone with the order URL. */}
        {needsSignInForAccess && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-sm">
            <p className="font-semibold text-foreground">Sign in to access your purchase</p>
            <p className="mt-1 text-muted-foreground">
              For your security, your course / content / group access is unlocked
              after you sign in with the email you purchased with.
            </p>
            <Button asChild className="mt-3">
              <Link href={`/account?next=${encodeURIComponent(`/order/${order.id}`)}`}>
                <LogIn className="mr-2 h-4 w-4" /> Sign in to access
              </Link>
            </Button>
          </div>
        )}

        {/* Failure helper */}
        {failed && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
            <p className="font-semibold">What to do</p>
            <p className="mt-1">
              The charge didn&apos;t go through. Your card / UPI account
              wasn&apos;t debited. You can retry from the same page — or use a
              different payment method.
            </p>
            {pageSlug && (
              <Button
                asChild
                className="mt-3 bg-none bg-rose-600 text-white hover:bg-rose-700"
              >
                <Link href={`/p/${pageSlug}`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try again
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Branded shareable receipt + share buttons (paid only) */}
        {paid && (
          <PaymentSuccessShare
            amount={Number(order.amount)}
            currency={order.currency}
            productName={productName}
            orderId={order.id}
            buyerName={order.buyer_name}
            sellerName={sellerName}
            dateText={formatDateTime(order.paid_at ?? order.created_at)}
            shareUrl={shareUrl}
          />
        )}

        {/* Back link */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {pageSlug ? (
            <Button asChild variant="ghost" className="flex-1">
              <Link href={`/p/${pageSlug}`}>
                <Home className="mr-2 h-4 w-4" />
                {sellerName ? `Back to ${sellerName}` : `Back to ${pageTitle ?? "page"}`}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" className="flex-1">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> Done
              </Link>
            </Button>
          )}
        </div>

        {/* Reach the seller about this order (signed-in buyer only). */}
        {owns && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <ContactSellerButton orderId={order.id} />
            <RequestRefundButton
              orderId={order.id}
              status={order.status}
              refundRequestStatus={order.refund_request_status}
            />
          </div>
        )}

        {/* Footer line */}
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Powered by{" "}
          <span className="font-sora font-semibold text-muted-foreground">InvoxAI</span>
        </p>
      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function NotFoundShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        invoxai.io / order
      </p>
      <h1 className="mt-2 font-sora text-3xl font-bold tracking-tight">
        We couldn&apos;t find that order
      </h1>
      <p className="mt-4 text-muted-foreground">
        If you just paid, give it a few seconds and refresh. Otherwise the
        order id may be wrong.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" /> Go home
        </Link>
      </Button>
    </main>
  );
}

/**
 * Animated status circle (success / failure / pending). The check-mark and
 * cross are SVG paths animated via stroke-dashoffset so they "draw" in on
 * mount. Pure CSS — no JS needed.
 */
function StatusCircle({
  variant,
}: {
  variant: "success" | "failure" | "pending";
}) {
  const colors = {
    success: { ring: "#10b981", glow: "rgba(16,185,129,0.25)" },
    failure: { ring: "#ef4444", glow: "rgba(239,68,68,0.25)" },
    pending: { ring: "#f59e0b", glow: "rgba(245,158,11,0.25)" },
  }[variant];

  return (
    <div className="flex justify-center">
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-lg"
        style={{
          animation:
            "ixaPopIn 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
          boxShadow: `0 12px 40px -10px ${colors.glow}`,
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden
        >
          <circle
            cx="40"
            cy="40"
            r="34"
            stroke={colors.ring}
            strokeWidth="4"
            fill={colors.ring}
            opacity="0.12"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            stroke={colors.ring}
            strokeWidth="4"
            fill="none"
          />
          {variant === "success" && (
            <path
              d="M26 41 L36 51 L54 31"
              stroke={colors.ring}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{
                strokeDasharray: 60,
                strokeDashoffset: 60,
                animation:
                  "ixaDrawStroke 500ms ease-out 200ms forwards",
              }}
            />
          )}
          {variant === "failure" && (
            <>
              <path
                d="M28 28 L52 52"
                stroke={colors.ring}
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 40,
                  strokeDashoffset: 40,
                  animation:
                    "ixaDrawStroke 350ms ease-out 200ms forwards",
                }}
              />
              <path
                d="M52 28 L28 52"
                stroke={colors.ring}
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 40,
                  strokeDashoffset: 40,
                  animation:
                    "ixaDrawStroke 350ms ease-out 350ms forwards",
                }}
              />
            </>
          )}
          {variant === "pending" && (
            <circle
              cx="40"
              cy="40"
              r="6"
              fill={colors.ring}
              style={{
                animation: "ixaPulseDot 1.6s ease-in-out infinite",
                transformOrigin: "40px 40px",
              }}
            />
          )}
        </svg>
      </div>

      <style
        // Local keyframes — kept inline so this single component is fully
        // self-contained without touching globals.css.
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes ixaPopIn {
              0% { opacity: 0; transform: scale(0.4); }
              60% { opacity: 1; transform: scale(1.08); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes ixaDrawStroke {
              to { stroke-dashoffset: 0; }
            }
            @keyframes ixaPulseDot {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.4); opacity: 0.5; }
            }
          `,
        }}
      />
    </div>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-xs font-semibold text-foreground"
            : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
