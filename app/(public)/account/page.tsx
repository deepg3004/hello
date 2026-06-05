// /account — buyer portal. Passwordless (email OTP) login, then every order,
// course, Telegram membership and invoice tied to the buyer's email, across all
// sellers. Resolves on the apex/app host (see middleware allow-list).

import { cookies } from "next/headers";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  FileText,
  Hash,
  Receipt,
  Send,
  ShoppingBag,
} from "lucide-react";

import { formatSlotLabel } from "@/lib/booking";

import { createAdminClient } from "@/lib/supabase/admin";
import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { signCourseToken } from "@/lib/course-token";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BuyerLogin } from "@/components/buyer/BuyerLogin";
import { BuyerLogoutButton } from "@/components/buyer/BuyerLogoutButton";

export const metadata = { title: "Your purchases" };
export const dynamic = "force-dynamic";

const inr = (rupees: number) => formatINR(Math.round(Number(rupees || 0) * 100));

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default async function BuyerAccountPage() {
  const token = cookies().get(BUYER_COOKIE)?.value;
  const email = token ? verifyBuyerSession(token) : null;
  if (!email) return <BuyerLogin />;

  const admin = createAdminClient();

  // Paid orders for this email across all sellers.
  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      "id, seller_user_id, product_id, page_id, amount, currency, status, created_at, products(name), pages(title, slug)",
    )
    .eq("buyer_email", email)
    .in("status", ["paid", "partially_refunded", "refunded"])
    .order("created_at", { ascending: false })
    .limit(200);

  const orders = (ordersRaw ?? []) as Array<{
    id: string;
    seller_user_id: string;
    product_id: string | null;
    page_id: string | null;
    amount: number;
    currency: string | null;
    status: string;
    created_at: string;
    products: { name: string } | { name: string }[] | null;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  // Deliverables keyed by order id.
  const [{ data: enrollRaw }, { data: tgRaw }, { data: dcRaw }, { data: invRaw }] =
    await Promise.all([
      admin
        .from("course_enrollments")
        .select("course_id, order_id, courses(title)")
        .eq("buyer_email", email),
      admin
        .from("telegram_memberships")
        .select("order_id, expires_at, status, telegram_vip_groups(group_name)")
        .eq("buyer_email", email),
      admin
        .from("discord_memberships")
        .select("order_id, expires_at, status, invite_link, discord_servers(guild_name)")
        .eq("buyer_email", email),
      admin
        .from("invoices")
        .select("order_id")
        .eq("buyer_email", email)
        .eq("status", "generated"),
    ]);

  // Bookings for this buyer (independent of orders).
  const { data: bookingRaw } = await admin
    .from("bookings")
    .select("id, start_at, status, booking_types(title, location)")
    .eq("buyer_email", email)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
    .limit(50);
  const bookings = ((bookingRaw ?? []) as Array<{
    id: string;
    start_at: string;
    status: string;
    booking_types: { title: string; location: string | null } | { title: string; location: string | null }[] | null;
  }>).map((b) => {
    const bt = Array.isArray(b.booking_types) ? b.booking_types[0] : b.booking_types;
    return {
      id: b.id,
      startAt: b.start_at,
      status: b.status,
      title: bt?.title ?? "Booking",
      location: bt?.location ?? null,
    };
  });

  const courseByOrder = new Map<
    string,
    { courseId: string; title: string }
  >();
  for (const e of (enrollRaw ?? []) as Array<{
    course_id: string;
    order_id: string | null;
    courses: { title: string } | { title: string }[] | null;
  }>) {
    if (!e.order_id) continue;
    const c = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    courseByOrder.set(e.order_id, {
      courseId: e.course_id,
      title: c?.title ?? "Course",
    });
  }

  const tgByOrder = new Map<
    string,
    { group: string; expiresAt: string | null; status: string }
  >();
  for (const t of (tgRaw ?? []) as Array<{
    order_id: string | null;
    expires_at: string | null;
    status: string | null;
    telegram_vip_groups: { group_name: string } | { group_name: string }[] | null;
  }>) {
    if (!t.order_id) continue;
    const g = Array.isArray(t.telegram_vip_groups)
      ? t.telegram_vip_groups[0]
      : t.telegram_vip_groups;
    tgByOrder.set(t.order_id, {
      group: g?.group_name ?? "VIP channel",
      expiresAt: t.expires_at,
      status: t.status ?? "active",
    });
  }

  const dcByOrder = new Map<
    string,
    { server: string; expiresAt: string | null; inviteLink: string | null }
  >();
  for (const d of (dcRaw ?? []) as Array<{
    order_id: string | null;
    expires_at: string | null;
    invite_link: string | null;
    discord_servers: { guild_name: string } | { guild_name: string }[] | null;
  }>) {
    if (!d.order_id) continue;
    const s = Array.isArray(d.discord_servers)
      ? d.discord_servers[0]
      : d.discord_servers;
    dcByOrder.set(d.order_id, {
      server: s?.guild_name ?? "Discord server",
      expiresAt: d.expires_at,
      inviteLink: d.invite_link,
    });
  }

  const invoiceOrders = new Set(
    ((invRaw ?? []) as Array<{ order_id: string }>).map((i) => i.order_id),
  );

  const totalSpent = orders
    .filter((o) => o.status !== "refunded")
    .reduce((a, o) => a + Number(o.amount ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-sora text-2xl font-bold tracking-tight">
              Your purchases
            </h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <BuyerLogoutButton />
      </div>

      {/* Summary */}
      {orders.length > 0 && (
        <div className="mb-6 flex gap-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="font-sora text-xl font-semibold">{orders.length}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Total spent</p>
            <p className="font-sora text-xl font-semibold">{inr(totalSpent)}</p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No purchases found for this email yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const product = Array.isArray(o.products)
              ? o.products[0]
              : o.products;
            const page = Array.isArray(o.pages) ? o.pages[0] : o.pages;
            const title =
              product?.name ?? page?.title ?? "Your purchase";
            const course = courseByOrder.get(o.id);
            const tg = tgByOrder.get(o.id);
            const dc = dcByOrder.get(o.id);
            const hasInvoice = invoiceOrders.has(o.id);
            const courseHref =
              course && o.status === "paid"
                ? `/course/${course.courseId}?t=${signCourseToken({
                    course_id: course.courseId,
                    order_id: o.id,
                    email,
                  })}`
                : null;

            return (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{title}</p>
                      {o.status !== "paid" && (
                        <Badge variant="secondary" className="capitalize">
                          {o.status.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inr(o.amount)} · {fmtDate(o.created_at)}
                    </p>
                    {tg && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Send className="mr-1 inline h-3 w-3" />
                        {tg.group}
                        {tg.expiresAt
                          ? ` · access until ${fmtDate(tg.expiresAt)}`
                          : ""}
                      </p>
                    )}
                    {dc && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Hash className="mr-1 inline h-3 w-3" />
                        {dc.server}
                        {dc.expiresAt
                          ? ` · access until ${fmtDate(dc.expiresAt)}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {courseHref && (
                      <Button asChild size="sm">
                        <Link href={courseHref}>
                          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                          Open course
                        </Link>
                      </Button>
                    )}
                    {dc?.inviteLink && o.status === "paid" && (
                      <Button asChild size="sm">
                        <a href={dc.inviteLink} target="_blank" rel="noreferrer">
                          <Hash className="mr-1.5 h-3.5 w-3.5" />
                          Join Discord
                        </a>
                      </Button>
                    )}
                    {hasInvoice && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/orders/${o.id}/invoice`} target="_blank" rel="noreferrer">
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          Invoice
                        </a>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/order/${o.id}`}>
                        <Receipt className="mr-1.5 h-3.5 w-3.5" />
                        Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bookings */}
      {bookings.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-sora text-lg font-semibold">
            <CalendarClock className="h-5 w-5 text-primary" />
            Your bookings
          </h2>
          <div className="space-y-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{b.title}</p>
                      {b.status !== "confirmed" && (
                        <Badge variant="secondary" className="capitalize">
                          {b.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatSlotLabel(b.startAt)} (IST)
                      {b.location ? ` · ${b.location}` : ""}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/bookings/${b.id}/ics`}>
                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                      Add to calendar
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
