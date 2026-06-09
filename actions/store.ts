"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { slugify } from "@/lib/templates/utils";
import { getTemplate } from "@/lib/templates/registry";
import { parseCsv } from "@/lib/csv";

interface Result {
  ok: boolean;
  message?: string;
}

/**
 * Set the physical-product attributes (shipping requirement + inventory) on the
 * product attached to one of the seller's pages. Stock null = untracked.
 */
export async function updateProductPhysicalAction(input: {
  page_id: string;
  requires_shipping: boolean;
  stock: number | null;
  sku?: string | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  // Verify the seller owns this page (and thus its product).
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id")
    .eq("id", input.page_id)
    .maybeSingle();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Page not found" };
  }

  const stock =
    input.stock === null || input.stock === undefined
      ? null
      : Math.max(0, Math.floor(Number(input.stock)));

  const { error } = await admin
    .from("products")
    .update({
      requires_shipping: !!input.requires_shipping,
      stock,
      sku: input.sku?.trim() || null,
    })
    .eq("page_id", input.page_id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/pages/${input.page_id}/edit`);
  return { ok: true };
}

/** Seller-level shipping config (flat fee + free-shipping threshold). */
export async function updateShippingConfigAction(input: {
  shipping_flat_fee: number;
  free_shipping_over: number | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      shipping_flat_fee: Math.max(0, Number(input.shipping_flat_fee) || 0),
      free_shipping_over:
        input.free_shipping_over && input.free_shipping_over > 0
          ? Number(input.free_shipping_over)
          : null,
    })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Update fulfillment status + tracking on one of the seller's orders. */
export async function updateFulfillmentAction(input: {
  order_id: string;
  fulfillment_status: "unfulfilled" | "packed" | "shipped" | "delivered";
  tracking_number?: string | null;
  tracking_url?: string | null;
}): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    fulfillment_status: input.fulfillment_status,
    tracking_number: input.tracking_number?.trim() || null,
    tracking_url: input.tracking_url?.trim() || null,
  };
  if (input.fulfillment_status === "shipped") {
    patch.shipped_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("orders")
    .update(patch)
    .eq("id", input.order_id)
    .eq("seller_user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store/orders");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Phase 2a — catalog product CRUD. A catalog product is a standalone product
// managed from the Store dashboard; it auto-gets its own published payment page
// (digital-product template) so the EXISTING single-item checkout works with no
// money-path change. Marked is_catalog=true to list it separately from page
// pricing tiers.
// ----------------------------------------------------------------------------

export type ProductType = "digital" | "physical" | "service";

export interface CatalogProductInput {
  name: string;
  /** Selling / offer price (what the buyer pays). */
  price: number;
  /** Optional MRP / "real" price — shown struck-through with a % off badge
   *  when it's higher than `price`. */
  original_price?: number | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  requires_shipping?: boolean;
  stock?: number | null;
  sku?: string | null;
  product_type?: ProductType;
  /** `pfile:<path>` sentinel for a private digital file, or null. */
  file_url?: string | null;
  file_name?: string | null;
  download_limit?: number | null;
}

function normStock(stock: number | null | undefined): number | null {
  return stock === null || stock === undefined
    ? null
    : Math.max(0, Math.floor(Number(stock)));
}

function normType(t: ProductType | undefined): ProductType {
  return t === "physical" || t === "service" ? t : "digital";
}

function normLimit(n: number | null | undefined): number | null {
  if (n === null || n === undefined || n === 0) return null;
  const v = Math.floor(Number(n));
  return v > 0 ? v : null;
}

/** MRP / "was" price — kept only when it's a positive number above the selling
 *  price (otherwise null, so no misleading strike-through shows). */
function normOriginal(
  original: number | null | undefined,
  price: number,
): number | null {
  if (original === null || original === undefined) return null;
  const v = Number(original);
  return v > 0 && v > price ? v : null;
}

/** Columns shared by create + update for the digital/physical/service fields. */
function typeFields(input: CatalogProductInput) {
  const product_type = normType(input.product_type);
  const isDigital = product_type === "digital";
  return {
    product_type,
    // Shipping is derived from the type so it can't drift.
    requires_shipping: product_type === "physical",
    file_url: isDigital ? input.file_url?.trim() || null : null,
    file_name: isDigital ? input.file_name?.trim()?.slice(0, 200) || null : null,
    download_limit: isDigital ? normLimit(input.download_limit) : null,
  };
}

export async function createCatalogProductAction(
  input: CatalogProductInput,
): Promise<Result & { productId?: string; slug?: string }> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Product name is required" };
  const price = Number(input.price);
  if (!(price > 0)) return { ok: false, message: "Price must be greater than 0" };

  const admin = createAdminClient();

  // Unique slug (nanoid suffix makes collisions astronomically unlikely).
  const base = slugify(name) || "product";
  let slug = `${base}-${nanoid(6)}`;
  const { data: clash } = await admin
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${base}-${nanoid(10)}`;

  const tpl = getTemplate("digital-product");
  const values: Record<string, unknown> = {
    ...(tpl?.defaultValues ?? {}),
    ...(input.image_url ? { mockup_url: input.image_url } : {}),
  };

  const { data: page, error: pageErr } = await admin
    .from("pages")
    .insert({
      user_id: ctx.ownerId,
      title: name,
      slug,
      type: "payment",
      status: "published",
      template_id: "digital-product",
      page_config: values,
      published_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();
  if (pageErr || !page) {
    return { ok: false, message: pageErr?.message ?? "Couldn't create the product page" };
  }

  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({
      user_id: ctx.ownerId,
      page_id: page.id,
      name,
      description: input.description?.trim() || null,
      price,
      original_price: normOriginal(input.original_price, price),
      currency: "INR",
      type: "one_time",
      active: true,
      is_catalog: true,
      image_url: input.image_url?.trim() || null,
      category: input.category?.trim() || null,
      stock: normStock(input.stock),
      sku: input.sku?.trim() || null,
      ...typeFields(input),
    })
    .select("id")
    .single();
  if (prodErr || !product) {
    // Roll back the orphan page.
    await admin.from("pages").delete().eq("id", page.id);
    return { ok: false, message: prodErr?.message ?? "Couldn't create the product" };
  }

  revalidatePath("/dashboard/store");
  return { ok: true, productId: product.id, slug: page.slug };
}

/** Load a catalog product the caller owns (returns the product + its page_id). */
async function ownedCatalogProduct(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  productId: string,
) {
  const { data } = await admin
    .from("products")
    .select("id, user_id, page_id, is_catalog")
    .eq("id", productId)
    .maybeSingle();
  if (!data || data.user_id !== ownerId) return null;
  return data;
}

export async function updateCatalogProductAction(
  productId: string,
  input: CatalogProductInput & { active?: boolean },
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Product name is required" };
  const price = Number(input.price);
  if (!(price > 0)) return { ok: false, message: "Price must be greater than 0" };

  const admin = createAdminClient();
  const product = await ownedCatalogProduct(admin, ctx.ownerId, productId);
  if (!product) return { ok: false, message: "Product not found" };

  const { error } = await admin
    .from("products")
    .update({
      name,
      description: input.description?.trim() || null,
      price,
      original_price: normOriginal(input.original_price, price),
      image_url: input.image_url?.trim() || null,
      category: input.category?.trim() || null,
      stock: normStock(input.stock),
      sku: input.sku?.trim() || null,
      active: input.active ?? true,
      ...typeFields(input),
    })
    .eq("id", productId);
  if (error) return { ok: false, message: error.message };

  // Keep the auto-page title in sync.
  if (product.page_id) {
    await admin.from("pages").update({ title: name }).eq("id", product.page_id);
  }

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Soft-delete: deactivate the product + archive its page (preserves order FKs). */
export async function deleteCatalogProductAction(productId: string): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const product = await ownedCatalogProduct(admin, ctx.ownerId, productId);
  if (!product) return { ok: false, message: "Product not found" };

  await admin.from("products").update({ active: false }).eq("id", productId);
  if (product.page_id) {
    await admin.from("pages").update({ status: "archived" }).eq("id", product.page_id);
  }
  await admin.from("collection_products").delete().eq("product_id", productId);

  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Phase 2a — collections (merchandising groups of products).
// ----------------------------------------------------------------------------

export async function createCollectionAction(input: {
  name: string;
  description?: string | null;
  image_url?: string | null;
}): Promise<Result & { id?: string }> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Collection name is required" };

  const admin = createAdminClient();
  const base = slugify(name) || "collection";
  // Per-seller unique slug.
  let slug = base;
  const { data: clash } = await admin
    .from("collections")
    .select("id")
    .eq("user_id", ctx.ownerId)
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${base}-${nanoid(5)}`;

  const { data, error } = await admin
    .from("collections")
    .insert({
      user_id: ctx.ownerId,
      name,
      slug,
      description: input.description?.trim() || null,
      image_url: input.image_url?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Failed" };

  revalidatePath("/dashboard/store");
  return { ok: true, id: data.id };
}

export async function updateCollectionAction(
  id: string,
  input: { name: string; description?: string | null; image_url?: string | null; active?: boolean },
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const name = input.name?.trim();
  if (!name) return { ok: false, message: "Collection name is required" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collections")
    .update({
      name,
      description: input.description?.trim() || null,
      image_url: input.image_url?.trim() || null,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function deleteCollectionAction(id: string): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { error } = await admin
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Replace a collection's product membership (the seller's own products only). */
export async function setCollectionProductsAction(
  collectionId: string,
  productIds: string[],
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  // Verify the collection belongs to the seller.
  const { data: col } = await admin
    .from("collections")
    .select("id, user_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (!col || col.user_id !== ctx.ownerId) {
    return { ok: false, message: "Collection not found" };
  }

  // Keep only products the seller actually owns.
  const { data: owned } = await admin
    .from("products")
    .select("id")
    .eq("user_id", ctx.ownerId)
    .in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  const validIds = new Set((owned ?? []).map((p) => p.id));

  await admin.from("collection_products").delete().eq("collection_id", collectionId);
  const rows = productIds
    .filter((id) => validIds.has(id))
    .map((id, idx) => ({ collection_id: collectionId, product_id: id, sort_order: idx }));
  if (rows.length > 0) {
    const { error } = await admin.from("collection_products").insert(rows);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Product variants (e.g. Size / Colour). Replace the full variant set for a
// catalog product the seller owns. order_items keeps a variant_name snapshot,
// so deleting a variant never breaks order history.
// ----------------------------------------------------------------------------

export interface VariantInput {
  name: string;
  price: number;
  stock?: number | null;
  sku?: string | null;
}

export async function setProductVariantsAction(
  productId: string,
  variants: VariantInput[],
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const product = await ownedCatalogProduct(admin, ctx.ownerId, productId);
  if (!product) return { ok: false, message: "Product not found" };

  const clean = (variants ?? [])
    .filter((v) => v.name?.trim() && Number(v.price) > 0)
    .map((v, idx) => ({
      product_id: productId,
      name: v.name.trim().slice(0, 120),
      price: Math.max(0, Number(v.price)),
      stock:
        v.stock === null || v.stock === undefined
          ? null
          : Math.max(0, Math.floor(Number(v.stock))),
      sku: v.sku?.trim() || null,
      sort_order: idx,
      active: true,
    }));

  await admin.from("product_variants").delete().eq("product_id", productId);
  if (clean.length > 0) {
    const { error } = await admin.from("product_variants").insert(clean);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Replace a catalog product's gallery (extra images beyond image_url). */
export async function setProductImagesAction(
  productId: string,
  urls: string[],
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const product = await ownedCatalogProduct(admin, ctx.ownerId, productId);
  if (!product) return { ok: false, message: "Product not found" };

  const clean = (urls ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 10)
    .map((url, idx) => ({ product_id: productId, url, sort_order: idx }));

  await admin.from("product_images").delete().eq("product_id", productId);
  if (clean.length > 0) {
    const { error } = await admin.from("product_images").insert(clean);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Seller-side: hide or unhide a review on their product/course. */
export async function setReviewVisibilityAction(
  reviewId: string,
  hidden: boolean,
): Promise<Result> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: review } = await admin
    .from("reviews")
    .select("id, seller_user_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "Review not found" };
  }
  const { error } = await admin
    .from("reviews")
    .update({ status: hidden ? "hidden" : "published", updated_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Bulk catalog import from CSV. Header row maps columns (case-insensitive):
// name, price, description, category, type (digital|physical|service), stock,
// sku, download_limit. Reuses createCatalogProductAction per row so each product
// gets its auto-created digital-product page (no money-path change). Capped to
// keep the request snappy.
// ----------------------------------------------------------------------------
export async function importCatalogCsvAction(
  csvText: string,
): Promise<Result & { created?: number; failed?: number }> {
  const actor = await requireActor("store.manage");
  if (!actor.ok) return { ok: false, message: actor.error };

  const rows = parseCsv(csvText || "");
  if (rows.length < 2) {
    return { ok: false, message: "CSV needs a header row + at least one product row." };
  }
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iName = col("name");
  const iPrice = col("price");
  if (iName < 0 || iPrice < 0) {
    return { ok: false, message: "CSV must have at least 'name' and 'price' columns." };
  }
  const iDesc = col("description");
  const iCat = col("category");
  const iType = col("type") >= 0 ? col("type") : col("product_type");
  const iStock = col("stock");
  const iSku = col("sku");
  const iDl = col("download_limit");

  const MAX = 100;
  const dataRows = rows.slice(1, 1 + MAX);
  let created = 0;
  let failed = 0;
  for (const r of dataRows) {
    const name = (r[iName] ?? "").trim();
    const price = Number((r[iPrice] ?? "").replace(/[^\d.]/g, ""));
    if (!name || !(price > 0)) {
      failed++;
      continue;
    }
    const typeRaw = iType >= 0 ? (r[iType] ?? "").trim().toLowerCase() : "";
    const product_type = (["digital", "physical", "service"].includes(typeRaw)
      ? typeRaw
      : "digital") as ProductType;
    const res = await createCatalogProductAction({
      name,
      price,
      description: iDesc >= 0 ? (r[iDesc] ?? "").trim() || null : null,
      category: iCat >= 0 ? (r[iCat] ?? "").trim() || null : null,
      product_type,
      stock: iStock >= 0 && (r[iStock] ?? "").trim() !== "" ? Number(r[iStock]) : null,
      sku: iSku >= 0 ? (r[iSku] ?? "").trim() || null : null,
      download_limit: iDl >= 0 && (r[iDl] ?? "").trim() !== "" ? Number(r[iDl]) : null,
    });
    if (res.ok) created++;
    else failed++;
  }

  revalidatePath("/dashboard/store");
  const capped = rows.length - 1 > MAX ? ` (first ${MAX} rows; ${rows.length - 1 - MAX} skipped)` : "";
  return {
    ok: created > 0,
    created,
    failed,
    message: `Imported ${created} product${created === 1 ? "" : "s"}${failed ? `, ${failed} skipped` : ""}${capped}.`,
  };
}
