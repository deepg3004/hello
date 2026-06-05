// POST /api/reviews — submit a star rating + review for a product or course.
// Requires the buyer to have actually purchased/enrolled (verified in
// submitReview). Rate-limited per email+IP.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { submitReview, type ReviewSubject } from "@/lib/reviews";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let body: {
    subject_type?: string;
    subject_id?: string;
    rating?: number;
    email?: string;
    name?: string;
    title?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subjectType = body.subject_type as ReviewSubject;
  if (subjectType !== "product" && subjectType !== "course") {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }
  if (!body.subject_id || typeof body.subject_id !== "string") {
    return NextResponse.json({ error: "Missing subject" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`review:${email}:${ip}`, 6, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  // Resolve the seller that owns the subject (so a review can't be filed against
  // the wrong seller).
  const admin = createAdminClient();
  let sellerUserId: string | null = null;
  if (subjectType === "product") {
    const { data } = await admin
      .from("products")
      .select("user_id")
      .eq("id", body.subject_id)
      .maybeSingle();
    sellerUserId = data?.user_id ?? null;
  } else {
    const { data } = await admin
      .from("courses")
      .select("seller_user_id")
      .eq("id", body.subject_id)
      .maybeSingle();
    sellerUserId = data?.seller_user_id ?? null;
  }
  if (!sellerUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await submitReview({
    subjectType,
    subjectId: body.subject_id,
    sellerUserId,
    email,
    name: body.name,
    rating: Number(body.rating),
    title: body.title,
    body: body.body,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, updated: result.updated });
}
