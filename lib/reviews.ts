// =============================================================================
// Reviews + ratings (shared by the store product pages AND course pages).
//
// A review targets a subject — a product or a course — via (subject_type,
// subject_id). We only accept a review from an email that actually purchased
// the product / enrolled in the course, so the star average can't be spammed.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewSubject = "product" | "course";

export interface ReviewSummary {
  average: number; // 0..5, one decimal
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewRow {
  id: string;
  buyer_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  created_at: string;
}

const EMPTY_SUMMARY: ReviewSummary = {
  average: 0,
  count: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/** Aggregate rating for one subject. */
export async function getReviewSummary(
  subjectType: ReviewSubject,
  subjectId: string,
): Promise<ReviewSummary> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reviews")
    .select("rating")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .eq("status", "published");
  return summarize((data ?? []).map((r) => Number(r.rating)));
}

/** Batched summaries for a list of subjects (used by the catalog grid). */
export async function getReviewSummaries(
  subjectType: ReviewSubject,
  subjectIds: string[],
): Promise<Map<string, ReviewSummary>> {
  const out = new Map<string, ReviewSummary>();
  if (subjectIds.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin
    .from("reviews")
    .select("subject_id, rating")
    .eq("subject_type", subjectType)
    .in("subject_id", subjectIds)
    .eq("status", "published");
  const byId = new Map<string, number[]>();
  for (const r of (data ?? []) as Array<{ subject_id: string; rating: number }>) {
    const arr = byId.get(r.subject_id) ?? [];
    arr.push(Number(r.rating));
    byId.set(r.subject_id, arr);
  }
  for (const id of subjectIds) out.set(id, summarize(byId.get(id) ?? []));
  return out;
}

/** Published reviews for one subject, newest first. */
export async function listReviews(
  subjectType: ReviewSubject,
  subjectId: string,
  limit = 50,
): Promise<ReviewRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reviews")
    .select("id, buyer_name, rating, title, body, verified, created_at")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ReviewRow[];
}

/**
 * Top verified reviews across ALL of a seller's products + courses, shaped as
 * storefront `Testimonial`s. Used to auto-fill the storefront testimonials
 * section with REAL social proof when the seller hasn't curated any. Picks
 * published 4★+ reviews that have a written body, newest first.
 */
export async function getSellerTestimonials(
  sellerUserId: string,
  limit = 6,
): Promise<
  Array<{ name: string; role: string; quote: string; avatar: string; rating: number }>
> {
  const admin = createAdminClient();

  // Subjects owned by this seller: catalog/product ids + course ids.
  const [{ data: products }, { data: courses }] = await Promise.all([
    admin.from("products").select("id").eq("user_id", sellerUserId),
    admin.from("courses").select("id").eq("seller_user_id", sellerUserId),
  ]);
  const productIds = (products ?? []).map((p) => p.id as string);
  const courseIds = (courses ?? []).map((c) => c.id as string);
  const subjectIds = [...productIds, ...courseIds];
  if (subjectIds.length === 0) return [];

  const { data } = await admin
    .from("reviews")
    .select("buyer_name, rating, title, body, created_at")
    .in("subject_id", subjectIds)
    .eq("status", "published")
    .gte("rating", 4)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  const rows = (data ?? []) as Array<{
    buyer_name: string | null;
    rating: number;
    title: string | null;
    body: string | null;
  }>;

  return rows
    .filter((r) => (r.body ?? "").trim().length > 0)
    .slice(0, limit)
    .map((r) => ({
      name: r.buyer_name?.trim() || "Verified buyer",
      role: "Verified buyer",
      quote: (r.title ? `**${r.title.trim()}** — ` : "") + (r.body ?? "").trim(),
      avatar: "",
      rating: Number(r.rating) || 5,
    }));
}

/**
 * Does this email have a PAID purchase of the subject? Products: a direct
 * (single-item) order with product_id, or a cart order_item with product_id.
 * Courses: an enrollment row.
 */
export async function hasPurchased(
  subjectType: ReviewSubject,
  subjectId: string,
  sellerUserId: string,
  email: string,
): Promise<{ purchased: boolean; orderId: string | null }> {
  const admin = createAdminClient();
  const lower = email.trim().toLowerCase();

  if (subjectType === "product") {
    // Direct single-item order.
    const { data: direct } = await admin
      .from("orders")
      .select("id")
      .eq("seller_user_id", sellerUserId)
      .eq("buyer_email", lower)
      .eq("status", "paid")
      .eq("product_id", subjectId)
      .limit(1);
    if (direct && direct.length > 0) return { purchased: true, orderId: direct[0].id };

    // Cart line item.
    const { data: items } = await admin
      .from("order_items")
      .select("order_id, orders!inner(buyer_email, status, seller_user_id)")
      .eq("product_id", subjectId)
      .limit(20);
    for (const it of (items ?? []) as Array<{
      order_id: string;
      orders: { buyer_email: string; status: string; seller_user_id: string } | { buyer_email: string; status: string; seller_user_id: string }[];
    }>) {
      const o = Array.isArray(it.orders) ? it.orders[0] : it.orders;
      if (o && o.status === "paid" && o.buyer_email === lower && o.seller_user_id === sellerUserId) {
        return { purchased: true, orderId: it.order_id };
      }
    }
    return { purchased: false, orderId: null };
  }

  // Course enrollment.
  const { data: enr } = await admin
    .from("course_enrollments")
    .select("id")
    .eq("course_id", subjectId)
    .eq("buyer_email", lower)
    .limit(1);
  return { purchased: (enr?.length ?? 0) > 0, orderId: null };
}

export interface SubmitReviewInput {
  subjectType: ReviewSubject;
  subjectId: string;
  sellerUserId: string;
  email: string;
  name?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
}

export type SubmitReviewResult =
  | { ok: true; updated: boolean }
  | { ok: false; status: number; error: string };

/** Insert or update a buyer's review for a subject. Requires a verified purchase. */
export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const rating = Math.floor(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) {
    return { ok: false, status: 400, error: "Pick a rating from 1 to 5 stars." };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: "A valid email is required." };
  }

  const { purchased, orderId } = await hasPurchased(
    input.subjectType,
    input.subjectId,
    input.sellerUserId,
    email,
  );
  if (!purchased) {
    return {
      ok: false,
      status: 403,
      error:
        input.subjectType === "course"
          ? "Only enrolled students can review this course."
          : "Only buyers can review this product. Use the email you bought with.",
    };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("reviews")
    .select("id")
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .eq("buyer_email", email)
    .maybeSingle();

  const fields = {
    seller_user_id: input.sellerUserId,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    order_id: orderId,
    buyer_email: email,
    buyer_name: input.name?.trim().slice(0, 120) || null,
    rating,
    title: input.title?.trim().slice(0, 140) || null,
    body: input.body?.trim().slice(0, 4000) || null,
    verified: true,
    status: "published" as const,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("reviews").update(fields).eq("id", existing.id);
    if (error) return { ok: false, status: 500, error: error.message };
    return { ok: true, updated: true };
  }
  const { error } = await admin.from("reviews").insert(fields);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, updated: false };
}

function summarize(ratings: number[]): ReviewSummary {
  if (ratings.length === 0) return { ...EMPTY_SUMMARY, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of ratings) {
    const k = Math.min(5, Math.max(1, Math.round(r))) as 1 | 2 | 3 | 4 | 5;
    breakdown[k] += 1;
    sum += r;
  }
  return {
    average: Math.round((sum / ratings.length) * 10) / 10,
    count: ratings.length,
    breakdown,
  };
}
