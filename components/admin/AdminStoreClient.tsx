"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Boxes, Loader2, PackageCheck, PackageX, Search, Truck } from "lucide-react";

import { adminUpdateFulfillmentAction } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn, formatINR } from "@/lib/utils";

const rupees = (n: number) => formatINR(n * 100);

export interface AdminStoreProduct {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string;
  price: number;
  category: string | null;
  stock: number | null;
  sku: string | null;
  requiresShipping: boolean;
  active: boolean;
}

export interface AdminStoreOrder {
  id: string;
  buyerName: string | null;
  buyerEmail: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  shippingFee: number;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  shippedAt: string | null;
  createdAt: string;
}

const FULFILL_TONE: Record<string, string> = {
  unfulfilled: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  packed: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function AdminStoreClient({
  products,
  orders,
}: {
  products: AdminStoreProduct[];
  orders: AdminStoreOrder[];
}) {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const physical = products.filter((p) => p.requiresShipping).length;
    const outOfStock = products.filter((p) => p.stock !== null && p.stock <= 0).length;
    const toShip = orders.filter((o) => o.fulfillmentStatus === "unfulfilled" || o.fulfillmentStatus === "packed").length;
    return { products: products.length, physical, outOfStock, toShip };
  }, [products, orders]);

  const fProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sellerName.toLowerCase().includes(s) ||
        (p.sku?.toLowerCase().includes(s) ?? false) ||
        (p.category?.toLowerCase().includes(s) ?? false),
    );
  }, [products, search]);

  const fOrders = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter(
      (o) =>
        o.buyerEmail.toLowerCase().includes(s) ||
        (o.buyerName?.toLowerCase().includes(s) ?? false) ||
        o.sellerName.toLowerCase().includes(s) ||
        (o.trackingNumber?.toLowerCase().includes(s) ?? false),
    );
  }, [orders, search]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Products" value={stats.products.toLocaleString("en-IN")} tile="tile-indigo" icon={Boxes} />
        <MiniStat label="Physical" value={stats.physical.toLocaleString("en-IN")} tile="tile-violet" icon={Truck} />
        <MiniStat label="Out of stock" value={stats.outOfStock.toLocaleString("en-IN")} tile="tile-rose" icon={PackageX} />
        <MiniStat label="To ship" value={stats.toShip.toLocaleString("en-IN")} tile="tile-emerald" icon={PackageCheck} />
      </div>

      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <TabBtn label={`Products (${products.length})`} active={tab === "products"} onClick={() => setTab("products")} />
          <TabBtn label={`Physical orders (${orders.length})`} active={tab === "orders"} onClick={() => setTab("orders")} />
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder={tab === "products" ? "Search product, seller, SKU…" : "Search buyer, seller, tracking…"}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        {tab === "products" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">Product</TableHead>
                <TableHead className="th-label">Seller</TableHead>
                <TableHead className="th-label">Category</TableHead>
                <TableHead className="th-label text-right">Price</TableHead>
                <TableHead className="th-label text-right">Stock</TableHead>
                <TableHead className="th-label">Type</TableHead>
                <TableHead className="th-label">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {products.length === 0 ? "No products yet." : "No matches."}
                  </TableCell>
                </TableRow>
              ) : (
                fProducts.map((p) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.sku && <div className="text-xs text-muted-foreground">SKU {p.sku}</div>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${p.sellerId}`} className="hover:underline">
                        {p.sellerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{rupees(p.price)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.stock === null ? <span className="text-muted-foreground">∞</span> : p.stock}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.requiresShipping ? "Physical" : "Digital"}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", p.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">Buyer</TableHead>
                <TableHead className="th-label">Seller</TableHead>
                <TableHead className="th-label text-right">Amount</TableHead>
                <TableHead className="th-label">Fulfillment</TableHead>
                <TableHead className="th-label">Tracking</TableHead>
                <TableHead className="th-label">Date</TableHead>
                <TableHead className="th-label text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {orders.length === 0 ? "No physical orders yet." : "No matches."}
                  </TableCell>
                </TableRow>
              ) : (
                fOrders.map((o) => (
                  <TableRow key={o.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{o.buyerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.buyerEmail}</div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${o.sellerId}`} className="hover:underline">
                        {o.sellerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono">{rupees(o.amount)}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", FULFILL_TONE[o.fulfillmentStatus] ?? "bg-muted text-muted-foreground")}>
                        {o.fulfillmentStatus}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.trackingNumber ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(o.createdAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <FulfillControl order={o} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

const FULFILL_STEPS = ["unfulfilled", "packed", "shipped", "delivered"] as const;

function FulfillControl({ order }: { order: AdminStoreOrder }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function set(status: (typeof FULFILL_STEPS)[number]) {
    let tracking: string | null = order.trackingNumber;
    if (status === "shipped") {
      const t = prompt("Tracking number (optional):", order.trackingNumber ?? "");
      if (t === null) return; // cancelled
      tracking = t.trim() || null;
    }
    setBusy(true);
    const r = await adminUpdateFulfillmentAction({
      order_id: order.id,
      fulfillment_status: status,
      tracking_number: tracking,
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: r.message ?? "Updated" });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {FULFILL_STEPS.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === order.fulfillmentStatus}
            onSelect={() => set(s)}
            className="capitalize"
          >
            Mark {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
        active
          ? "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300"
          : "border border-border bg-card text-muted-foreground ring-transparent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
  tile,
  icon: Icon,
}: {
  label: string;
  value: string;
  tile: string;
  icon: typeof Boxes;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md">
      <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}
