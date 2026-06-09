// Udemy-style course catalog at <subdomain>/course. Lists a seller's published
// courses with search, category, level filter, sort and ratings. Detail pages
// live at /course/<slug> (the global host-aware course route).

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewSummaries } from "@/lib/reviews";
import { resolveSurfaceConfig, resolveChromeConfig } from "@/lib/storefront-theme";
import { topSellingCourseIds } from "@/lib/storefront-sections";
import { StorefrontShell, PromoBanner } from "@/components/store/StorefrontShell";
import { StorefrontBanners } from "@/components/store/StorefrontBanners";
import { TestimonialsSection } from "@/components/store/TestimonialsSection";
import { FaqSection } from "@/components/store/FaqSection";
import { FeaturesSection } from "@/components/store/FeaturesSection";
import { BrandLogoSlider } from "@/components/store/BrandLogoSlider";
import { CourseCatalog } from "@/components/courses/CourseCatalog";
import { CourseCard, type CourseCardItem } from "@/components/courses/CourseCard";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  noStore();
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("user_profiles")
    .select("legal_business_name, full_name, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  const cfg = resolveSurfaceConfig(p?.storefront_config, "courses");
  const name = p?.legal_business_name ?? p?.full_name ?? params.username;
  return {
    title: cfg.title.trim() || `${name} — Courses`,
    icons: cfg.favicon ? { icon: cfg.favicon } : undefined,
  };
}

export default async function CourseCatalogPage({ params }: Props) {
  noStore();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url, tagline, storefront_config")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const cfg = resolveSurfaceConfig(profile.storefront_config, "courses");
  const chrome = resolveChromeConfig(profile.storefront_config);

  const { data: coursesRaw } = await admin
    .from("courses")
    .select("id, slug, title, subtitle, thumbnail_url, instructor_name, level, category, product_id, created_at")
    .eq("seller_user_id", profile.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const courses = (coursesRaw ?? []) as Array<{
    id: string;
    slug: string | null;
    title: string;
    subtitle: string | null;
    thumbnail_url: string | null;
    instructor_name: string | null;
    level: string | null;
    category: string | null;
    product_id: string | null;
  }>;

  const courseIds = courses.map((c) => c.id);
  const productIds = courses.map((c) => c.product_id).filter((x): x is string => !!x);

  // Prices (linked product), ratings, lesson counts, student counts.
  const priceByProduct = new Map<string, { price: number; original: number | null }>();
  if (productIds.length) {
    const { data: prods } = await admin.from("products").select("id, price, original_price").in("id", productIds);
    for (const p of (prods ?? []) as Array<{ id: string; price: number; original_price: number | null }>) {
      priceByProduct.set(p.id, {
        price: Number(p.price ?? 0),
        original: p.original_price != null ? Number(p.original_price) : null,
      });
    }
  }

  const ratings = await getReviewSummaries("course", courseIds);

  const lessonCount = new Map<string, number>();
  const studentCount = new Map<string, number>();
  if (courseIds.length) {
    const { data: mods } = await admin.from("course_modules").select("id, course_id").in("course_id", courseIds);
    const modRows = (mods ?? []) as Array<{ id: string; course_id: string }>;
    if (modRows.length) {
      const { data: ls } = await admin.from("course_lessons").select("module_id").in("module_id", modRows.map((m) => m.id));
      const courseByModule = new Map(modRows.map((m) => [m.id, m.course_id]));
      for (const l of (ls ?? []) as Array<{ module_id: string }>) {
        const cid = courseByModule.get(l.module_id);
        if (cid) lessonCount.set(cid, (lessonCount.get(cid) ?? 0) + 1);
      }
    }
    const { data: enr } = await admin.from("course_enrollments").select("course_id").in("course_id", courseIds);
    for (const e of (enr ?? []) as Array<{ course_id: string }>) {
      studentCount.set(e.course_id, (studentCount.get(e.course_id) ?? 0) + 1);
    }
  }

  const items: CourseCardItem[] = courses.map((c) => {
    const price = c.product_id ? priceByProduct.get(c.product_id) : null;
    const r = ratings.get(c.id);
    return {
      id: c.id,
      slug: c.slug ?? c.id,
      title: c.title,
      subtitle: c.subtitle,
      thumbnail_url: c.thumbnail_url,
      instructor: c.instructor_name,
      level: c.level,
      category: c.category,
      price: price ? price.price : null,
      original_price: price ? price.original : null,
      lessons: lessonCount.get(c.id) ?? 0,
      students: studentCount.get(c.id) ?? 0,
      rating: { average: r?.average ?? 0, count: r?.count ?? 0 },
    };
  });

  const categories = Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c))).sort();
  const levels = Array.from(new Set(items.map((i) => i.level).filter((l): l is string => !!l)));
  const sellerName = profile.legal_business_name ?? profile.full_name ?? params.username;

  // Top-selling courses (by enrollment), mapped to loaded items in rank order.
  let topItems: CourseCardItem[] = [];
  if (cfg.sections.topSelling && items.length > 0) {
    const byId = new Map(items.map((c) => [c.id, c]));
    topItems = (await topSellingCourseIds(profile.id, 6))
      .map((id) => byId.get(id))
      .filter((c): c is CourseCardItem => !!c);
  }

  return (
    <StorefrontShell cfg={cfg} chrome={chrome} brandName={sellerName} sellerId={profile.id} username={params.username}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <StorefrontBanners banners={cfg.banners} autoplay={cfg.bannerAutoplay} />
        <PromoBanner cfg={cfg} />

        {cfg.sections.features && <FeaturesSection items={chrome.features} align={cfg.sectionAlign} />}

        {topItems.length > 0 && (
          <section className="mb-10">
            <h2 className="sf-display mb-4 text-xl font-bold tracking-tight">🔥 Most popular</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topItems.map((c) => (
                <CourseCard key={c.id} c={c} base="/course" cardStyle={cfg.card} showRatings={cfg.sections.ratings} />
              ))}
            </div>
          </section>
        )}

        {items.length === 0 ? (
          <p className="sf-muted py-20 text-center">No courses published yet. Check back soon.</p>
        ) : (
          <CourseCatalog items={items} categories={categories} levels={levels} base="/course" cardStyle={cfg.card} showRatings={cfg.sections.ratings} cols={cfg.cols} />
        )}

        {cfg.sections.testimonials && <TestimonialsSection items={chrome.testimonials} align={cfg.sectionAlign} />}
        {cfg.sections.brands && <BrandLogoSlider logos={chrome.brandLogos} />}
        {cfg.sections.faq && <FaqSection items={chrome.faqs} align={cfg.sectionAlign} />}
      </main>
    </StorefrontShell>
  );
}
