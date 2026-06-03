import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentSuccessShare } from "@/components/pages/PaymentSuccessShare";
import { TelegramInviteCard } from "@/components/pages/TelegramInviteCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseForProduct } from "@/lib/courses";
import { signCourseToken } from "@/lib/course-token";
import { publicPageUrl } from "@/lib/page-url";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Order" };

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
      "id, amount, currency, status, buyer_email, buyer_name, paid_at, created_at, product_id, telegram_invite_link, page_id",
    )
    .eq("id", params.id)
    .single<OrderRow>();

  if (!order) {
    return <NotFoundShell />;
  }

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
  const courseHref =
    course && order.status === "paid"
      ? `/course/${course.id}?t=${signCourseToken({
          course_id: course.id,
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

  return (
    <main
      className={cn(
        "min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 pt-12 md:py-16",
        paid ? "pb-28 md:pb-16" : "pb-12",
      )}
    >
      <div className="mx-auto max-w-xl space-y-6">
        {/* Animated status circle */}
        {paid && <StatusCircle variant="success" />}
        {failed && <StatusCircle variant="failure" />}
        {!paid && !failed && <StatusCircle variant="pending" />}

        {/* Heading + buyer line */}
        <div className="text-center">
          <h1 className="font-sora text-3xl font-bold tracking-tight text-zinc-900 sm:text-[32px]">
            {paid
              ? "Payment Successful! 🎉"
              : failed
                ? "Payment Failed"
                : "Order Received"}
          </h1>
          <p className="mt-2 text-lg text-zinc-600 sm:text-xl">
            {paid
              ? `Thank you${order.buyer_name ? `, ${order.buyer_name}` : ""}`
              : failed
                ? "We couldn't capture this payment."
                : "Hold tight — confirmation is on its way."}
          </p>
        </div>

        {/* Order summary card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Order summary
          </p>
          <div className="mt-3 space-y-2.5">
            <KV
              label="Order ID"
              value={`#${order.id.slice(0, 8).toUpperCase()}`}
              mono
            />
            <KV label="Product" value={productName} />
            <KV
              label="Date"
              value={formatDateTime(order.paid_at ?? order.created_at)}
            />
            <KV label="Email" value={order.buyer_email} />
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-zinc-200 pt-4">
            <span className="text-sm font-medium text-zinc-700">
              {paid ? "Amount paid" : "Amount"}
            </span>
            <span
              className={
                "font-sora text-3xl font-bold " +
                (paid ? "text-emerald-600" : "text-zinc-900")
              }
            >
              ₹{Number(order.amount).toLocaleString("en-IN")}
              <span className="ml-1 text-xs font-normal text-zinc-500">
                {order.currency}
              </span>
            </span>
          </div>
        </div>

        {/* Course access — only when the product unlocks a course and paid */}
        {courseHref && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm">
            <p className="font-semibold text-indigo-900">🎓 Your course is ready</p>
            <p className="mt-1 text-indigo-800">
              Access <span className="font-medium">{course!.title}</span> any time
              from this link (bookmark it).
            </p>
            <Button asChild className="mt-3 bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href={courseHref}>Access your course →</Link>
            </Button>
          </div>
        )}

        {/* Telegram invite card — only when present and order is paid */}
        {paid && order.telegram_invite_link && (
          <TelegramInviteCard
            inviteLink={order.telegram_invite_link}
            groupName={groupName ?? "the VIP group"}
            buyerEmail={order.buyer_email}
          />
        )}

        {/* Failure helper */}
        {failed && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
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

        {/* Footer line */}
        <p className="pt-2 text-center text-[11px] text-zinc-400">
          Powered by{" "}
          <span className="font-sora font-semibold text-zinc-500">InvoxAI</span>
        </p>
      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function NotFoundShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        invoxai.io / order
      </p>
      <h1 className="mt-2 font-sora text-3xl font-bold tracking-tight">
        We couldn&apos;t find that order
      </h1>
      <p className="mt-4 text-zinc-600">
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
        className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg"
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
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-xs font-semibold text-zinc-900"
            : "font-medium text-zinc-900"
        }
      >
        {value}
      </span>
    </div>
  );
}
