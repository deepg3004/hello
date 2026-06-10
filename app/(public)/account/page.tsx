// /account — buyer portal. Passwordless (email OTP) login, then every order,
// course, Telegram membership and invoice tied to the buyer's email, across all
// sellers. Resolves on the apex/app host (see middleware allow-list).

import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  Download,
  FileText,
  Hash,
  Receipt,
  RefreshCw,
  Send,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { formatSlotLabel } from "@/lib/booking";

import { createAdminClient } from "@/lib/supabase/admin";
import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { buyerGoogleEnabled } from "@/lib/buyer-google";
import { signCourseToken } from "@/lib/course-token";
import { formatINR } from "@/lib/utils";
import {
  extractSubdomain,
  isPlatformOwnHost,
  platformRootDomain,
} from "@/lib/domains";
import {
  resolveSurfaceConfig,
  resolveChromeConfig,
} from "@/lib/storefront-theme";
import { StorefrontShell } from "@/components/store/StorefrontShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BuyerLogin } from "@/components/buyer/BuyerLogin";
import { BuyerLogoutButton } from "@/components/buyer/BuyerLogoutButton";
import {
  BuyerAccountShell,
  type AccountTab,
} from "@/components/buyer/BuyerAccountShell";
import { WishlistItems } from "@/components/buyer/WishlistItems";
import { AddressBook } from "@/components/buyer/AddressBook";
import { ContactSellerButton } from "@/components/buyer/ContactSellerButton";
import { RequestRefundButton } from "@/components/buyer/RequestRefundButton";

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

interface StoreHost {
  id: string;
  subdomain: string | null;
  full_name: string | null;
  legal_business_name: string | null;
  storefront_config: unknown;
}

/**
 * The seller whose storefront the buyer is browsing, derived from the request
 * host (a `*.invoxai.io` subdomain or a verified custom domain). Lets /account
 * render inside that storefront's themed chrome — header, footer and the mobile
 * bottom nav — instead of as a bare page. Returns null on the platform's own
 * hosts (apex / app.* ), where there is no single seller context.
 */
async function resolveStoreHost(
  admin: ReturnType<typeof createAdminClient>,
): Promise<StoreHost | null> {
  const host = (headers().get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  if (!host || isPlatformOwnHost(host)) return null;

  const sub = extractSubdomain(host);
  if (sub) {
    const { data } = await admin
      .from("user_profiles")
      .select("id, subdomain, full_name, legal_business_name, storefront_config")
      .eq("subdomain", sub)
      .maybeSingle();
    return data?.id ? (data as StoreHost) : null;
  }

  // A label under our apex that isn't a claimed subdomain — no seller.
  if (host.endsWith(`.${platformRootDomain()}`)) return null;

  // Otherwise treat it as a custom domain (only when verified).
  const { data } = await admin
    .from("user_profiles")
    .select(
      "id, subdomain, full_name, legal_business_name, custom_domain_verified_at, storefront_config",
    )
    .eq("custom_domain", host)
    .maybeSingle();
  return data?.id && data.custom_domain_verified_at ? (data as StoreHost) : null;
}

export default async function BuyerAccountPage() {
  const admin = createAdminClient();

  // On a seller's storefront host, wrap content in that store's themed chrome
  // (header, footer and — crucially on mobile — the bottom nav). Applies to
  // BOTH the login screen and the logged-in account so the nav never vanishes.
  const storeHost = await resolveStoreHost(admin);
  const withChrome = (node: ReactNode): ReactNode => {
    if (!storeHost) return node;
    const cfg = resolveSurfaceConfig(storeHost.storefront_config, "home");
    const chrome = resolveChromeConfig(storeHost.storefront_config);
    const brandName =
      storeHost.legal_business_name ?? storeHost.full_name ?? "Store";
    return (
      <StorefrontShell
        cfg={cfg}
        chrome={chrome}
        brandName={brandName}
        sellerId={storeHost.id}
      >
        {node}
      </StorefrontShell>
    );
  };

  const token = cookies().get(BUYER_COOKIE)?.value;
  const email = token ? verifyBuyerSession(token) : null;
  if (!email) {
    const googleEnabled = await buyerGoogleEnabled();
    return withChrome(
      <div className="bg-background text-foreground">
        <BuyerLogin googleEnabled={googleEnabled} />
      </div>,
    );
  }
  // Narrowed to string here, but the narrowing is lost inside nested helpers
  // (renderOrderCard) — capture it so course-token signing stays type-safe.
  const buyerEmail: string = email;
  // Match the buyer's email case-INSENSITIVELY so orders placed with a
  // different capitalisation still surface (LIKE wildcards escaped).
  const emailLike = email.replace(/([\\%_])/g, "\\$1");

  // Paid orders for this email across all sellers.
  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      "id, seller_user_id, product_id, page_id, amount, currency, status, created_at, fulfillment_status, tracking_number, tracking_url, refund_request_status, products!orders_product_id_fkey(name), pages(title, slug)",
    )
    .ilike("buyer_email", emailLike)
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
    fulfillment_status: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    refund_request_status: string | null;
    products: { name: string } | { name: string }[] | null;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  // Deliverables keyed by order id.
  const [{ data: enrollRaw }, { data: tgRaw }, { data: dcRaw }, { data: invRaw }] =
    await Promise.all([
      admin
        .from("course_enrollments")
        .select("course_id, order_id, courses(title)")
        .ilike("buyer_email", emailLike),
      admin
        .from("telegram_memberships")
        .select("order_id, expires_at, status, telegram_vip_groups(group_name)")
        .ilike("buyer_email", emailLike),
      admin
        .from("discord_memberships")
        .select("order_id, expires_at, status, invite_link, discord_servers(guild_name)")
        .ilike("buyer_email", emailLike),
      admin
        .from("invoices")
        .select("order_id")
        .ilike("buyer_email", emailLike)
        .eq("status", "generated"),
    ]);

  // Wishlist + saved addresses (migration 085). Tolerant of a not-yet-applied
  // migration — a missing-table error degrades to an empty list.
  const wishlistRows = await admin
    .from("buyer_wishlist")
    .select("id, title, page_id, created_at, pages(slug, status)")
    .ilike("buyer_email", emailLike)
    .order("created_at", { ascending: false })
    .then((r) => r.data ?? []);
  const wishlist = (wishlistRows as Array<{
    id: string;
    title: string | null;
    pages: { slug: string; status: string } | { slug: string; status: string }[] | null;
  }>).map((w) => {
    const pg = Array.isArray(w.pages) ? w.pages[0] : w.pages;
    return {
      id: w.id,
      title: w.title || "Saved item",
      slug: pg?.slug ?? null,
      available: pg?.status === "published",
    };
  });

  const addressRows = await admin
    .from("buyer_addresses")
    .select("id, full_name, phone, line1, line2, city, state, pincode, country, is_default")
    .ilike("buyer_email", emailLike)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .then((r) => r.data ?? []);
  const addresses = addressRows as Array<{
    id: string;
    full_name: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    pincode: string;
    country: string;
    is_default: boolean;
  }>;

  // Bookings for this buyer (independent of orders).
  const { data: bookingRaw } = await admin
    .from("bookings")
    .select("id, start_at, status, booking_types(title, location)")
    .ilike("buyer_email", emailLike)
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

  // Digital download grants for this buyer.
  const { data: dlRaw } = await admin
    .from("download_grants")
    .select("token, file_name, download_limit, downloads_used, created_at, products(name)")
    .ilike("buyer_email", emailLike)
    .order("created_at", { ascending: false })
    .limit(100);
  const downloads = ((dlRaw ?? []) as Array<{
    token: string;
    file_name: string | null;
    download_limit: number | null;
    downloads_used: number;
    products: { name: string } | { name: string }[] | null;
  }>).map((d) => {
    const p = Array.isArray(d.products) ? d.products[0] : d.products;
    const remaining = d.download_limit == null ? null : Math.max(0, d.download_limit - (d.downloads_used ?? 0));
    return {
      token: d.token,
      name: p?.name ?? d.file_name ?? "Download",
      remaining,
      limit: d.download_limit,
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

  // ── Flat lists for the Courses / Memberships tabs (paid orders only) ──
  const paidOrders = orders.filter((o) => o.status === "paid");
  const courseList = paidOrders
    .map((o) => {
      const c = courseByOrder.get(o.id);
      if (!c) return null;
      return {
        id: o.id,
        title: c.title,
        href: `/course/${c.courseId}?t=${signCourseToken({
          course_id: c.courseId,
          order_id: o.id,
          email,
        })}`,
      };
    })
    .filter((x): x is { id: string; title: string; href: string } => x !== null);

  const membershipList = paidOrders
    .map((o) => {
      const tg = tgByOrder.get(o.id) ?? null;
      const dc = dcByOrder.get(o.id) ?? null;
      if (!tg && !dc) return null;
      return { id: o.id, tg, dc };
    })
    .filter((x) => x !== null) as Array<{
    id: string;
    tg: { group: string; expiresAt: string | null; status: string } | null;
    dc: {
      server: string;
      expiresAt: string | null;
      inviteLink: string | null;
    } | null;
  }>;

  // ── Reusable order card (used in Orders + the Dashboard preview) ──────
  function renderOrderCard(o: (typeof orders)[number]) {
    const product = Array.isArray(o.products) ? o.products[0] : o.products;
    const page = Array.isArray(o.pages) ? o.pages[0] : o.pages;
    const title = product?.name ?? page?.title ?? "Your purchase";
    const course = courseByOrder.get(o.id);
    const tg = tgByOrder.get(o.id);
    const dc = dcByOrder.get(o.id);
    const hasInvoice = invoiceOrders.has(o.id);
    const courseHref =
      course && o.status === "paid"
        ? `/course/${course.courseId}?t=${signCourseToken({
            course_id: course.courseId,
            order_id: o.id,
            email: buyerEmail,
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
                {tg.expiresAt ? ` · access until ${fmtDate(tg.expiresAt)}` : ""}
              </p>
            )}
            {dc && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Hash className="mr-1 inline h-3 w-3" />
                {dc.server}
                {dc.expiresAt ? ` · access until ${fmtDate(dc.expiresAt)}` : ""}
              </p>
            )}
            {o.fulfillment_status && o.fulfillment_status !== "unfulfilled" && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Truck className="mr-1 inline h-3 w-3" />
                <span className="capitalize">{o.fulfillment_status}</span>
                {o.tracking_number ? (
                  o.tracking_url ? (
                    <>
                      {" · "}
                      <a
                        href={o.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Track {o.tracking_number}
                      </a>
                    </>
                  ) : (
                    ` · ${o.tracking_number}`
                  )
                ) : null}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
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
                <a
                  href={`/api/orders/${o.id}/invoice`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Invoice
                </a>
              </Button>
            )}
            {page?.slug && o.status === "paid" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/p/${page.slug}`}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Buy again
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/order/${o.id}`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Details
              </Link>
            </Button>
            <ContactSellerButton orderId={o.id} />
            <RequestRefundButton
              orderId={o.id}
              status={o.status}
              refundRequestStatus={o.refund_request_status}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  const emptyState = (msg: string) => (
    <EmptyState icon={ShoppingBag} title={msg} />
  );

  // ── Tab content ───────────────────────────────────────────────────────
  const dashboardNode = (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <h2 className="font-sora text-lg font-semibold">Welcome back 👋</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View your orders, download your files, and open your courses,
          memberships and bookings — all in one place.
        </p>
      </div>
      {paidOrders.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Recent orders
          </h3>
          <div className="space-y-3">
            {orders.slice(0, 3).map((o) => renderOrderCard(o))}
          </div>
        </div>
      ) : (
        emptyState("No purchases found for this email yet.")
      )}
    </div>
  );

  const ordersNode =
    orders.length === 0
      ? emptyState("No purchases found for this email yet.")
      : <div className="space-y-3">{orders.map((o) => renderOrderCard(o))}</div>;

  const downloadsNode =
    downloads.length === 0
      ? emptyState("No downloadable files yet.")
      : (
          <div className="space-y-3">
            {downloads.map((d) => {
              const exhausted = d.remaining === 0;
              return (
                <Card key={d.token}>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.limit == null
                          ? "Unlimited downloads"
                          : exhausted
                            ? "Emailed-link limit reached — re-download here anytime"
                            : `${d.remaining} of ${d.limit} on the emailed link · re-download here anytime`}
                      </p>
                    </div>
                    {/* Signed-in re-download — identity-verified, so it always
                        works regardless of the emailed link's limit. */}
                    <Button asChild size="sm" variant={exhausted ? "outline" : "default"}>
                      <a href={`/api/account/download/${d.token}`}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {exhausted ? "Download again" : "Download"}
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

  const coursesNode =
    courseList.length === 0
      ? emptyState("You haven't enrolled in any courses yet.")
      : (
          <div className="space-y-3">
            {courseList.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="truncate font-medium">{c.title}</p>
                  <Button asChild size="sm">
                    <Link href={c.href}>
                      <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                      Open course
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        );

  const membershipsNode =
    membershipList.length === 0
      ? emptyState("No community memberships yet.")
      : (
          <div className="space-y-3">
            {membershipList.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {m.tg && (
                      <p className="flex items-center gap-1.5 font-medium">
                        <Send className="h-3.5 w-3.5 text-primary" />
                        {m.tg.group}
                      </p>
                    )}
                    {m.dc && (
                      <p className="flex items-center gap-1.5 font-medium">
                        <Hash className="h-3.5 w-3.5 text-primary" />
                        {m.dc.server}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(m.tg?.expiresAt || m.dc?.expiresAt)
                        ? `Access until ${fmtDate(m.tg?.expiresAt ?? m.dc?.expiresAt ?? null)}`
                        : "Active"}
                    </p>
                  </div>
                  {m.dc?.inviteLink && (
                    <Button asChild size="sm">
                      <a
                        href={m.dc.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Hash className="mr-1.5 h-3.5 w-3.5" />
                        Join Discord
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        );

  const bookingsNode =
    bookings.length === 0
      ? emptyState("No bookings yet.")
      : (
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
        );

  const accountNode = (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="font-medium">{email}</p>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="font-sora text-lg font-semibold">{orders.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total spent</p>
            <p className="font-sora text-lg font-semibold">{inr(totalSpent)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          We recognise you by email — sign out on shared devices.
        </p>
        <BuyerLogoutButton />
      </CardContent>
    </Card>
  );

  // Always show Dashboard / Orders / Account; show the rest only when
  // there's something in them (keeps the nav uncluttered for single-type
  // buyers).
  const tabs: AccountTab[] = [
    { key: "dashboard", label: "Dashboard", content: dashboardNode },
    { key: "orders", label: "Orders", count: orders.length, content: ordersNode },
  ];
  if (downloads.length)
    tabs.push({ key: "downloads", label: "Downloads", count: downloads.length, content: downloadsNode });
  if (courseList.length)
    tabs.push({ key: "courses", label: "Courses", count: courseList.length, content: coursesNode });
  if (membershipList.length)
    tabs.push({ key: "memberships", label: "Memberships", count: membershipList.length, content: membershipsNode });
  if (bookings.length)
    tabs.push({ key: "bookings", label: "Bookings", count: bookings.length, content: bookingsNode });
  tabs.push({
    key: "wishlist",
    label: "Wishlist",
    count: wishlist.length,
    content: <WishlistItems items={wishlist} />,
  });
  tabs.push({
    key: "addresses",
    label: "Addresses",
    count: addresses.length,
    content: <AddressBook addresses={addresses} />,
  });
  tabs.push({ key: "account", label: "Account details", content: accountNode });

  // Persistent summary — shown above the tabs so Orders / Total spent stay
  // visible on every tab (not just the dashboard).
  const summaryCards: Array<{
    icon: ReactNode;
    label: string;
    value: string | number;
    tile: string;
  }> = [
    { icon: <ShoppingBag className="h-5 w-5" />, label: "Orders", value: orders.length, tile: "tile-indigo" },
    { icon: <Receipt className="h-5 w-5" />, label: "Total spent", value: inr(totalSpent), tile: "tile-emerald" },
    { icon: <BookOpen className="h-5 w-5" />, label: "Courses", value: courseList.length, tile: "tile-violet" },
    { icon: <Download className="h-5 w-5" />, label: "Downloads", value: downloads.length, tile: "tile-amber" },
  ];

  // Keep the account content on a neutral surface (bg-background) so it stays
  // readable even when wrapped in a dark storefront theme below.
  const inner = (
    <div className="bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-10">
        {/* Header — gradient hero strip, stacks cleanly on mobile */}
        <div className="mb-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-sora text-lg font-bold uppercase text-primary-foreground shadow-sm">
                {email.trim().charAt(0) || "?"}
              </div>
              <div className="min-w-0">
                <h1 className="font-sora text-xl font-bold tracking-tight sm:text-2xl">
                  My Account
                </h1>
                <p className="truncate text-sm text-muted-foreground">{email}</p>
              </div>
            </div>
            <BuyerLogoutButton />
          </div>
        </div>

        {/* Summary cards — always visible, 2-up on phones / 4-up on desktop */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-4">
          {summaryCards.map((s) => (
            <div
              key={s.label}
              className="card-surface card-surface-hover flex items-center gap-3 p-3.5 sm:p-4"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${s.tile}`}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="truncate font-sora text-base font-bold tracking-tight tabular-nums sm:text-xl">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <BuyerAccountShell tabs={tabs} />
      </main>
    </div>
  );

  return withChrome(inner);
}
