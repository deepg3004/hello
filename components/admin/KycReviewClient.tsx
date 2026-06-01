"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  User2,
  X,
} from "lucide-react";

import { KycReviewActions } from "@/components/admin/KycReviewActions";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn, formatDateTime } from "@/lib/utils";

export type KycReviewStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export interface KycReviewItem {
  id: string;
  user_id: string;
  level: number | null;
  status: string;
  pan_number: string | null;
  pan_name: string | null;
  pan_verified_at: string | null;
  bank_verified_at: string | null;
  selfie_url: string | null;
  id_document_url: string | null;
  risk_flags: string[];
  created_at: string;
  rejection_reason: string | null;
  buyer_full_name: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_holder_name: string | null;
}

interface KycReviewClientProps {
  items: KycReviewItem[];
}

const TABS: Array<{ value: KycReviewStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

// Deterministic avatar palette (matches the rest of the admin UI)
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
] as const;

function gradientFor(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}

function initials(s: string): string {
  return s
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function KycReviewClient({ items }: KycReviewClientProps) {
  const [tab, setTab] = useState<KycReviewStatus>("pending");

  const grouped = useMemo(() => {
    const out: Record<KycReviewStatus, KycReviewItem[]> = {
      pending: [],
      under_review: [],
      approved: [],
      rejected: [],
    };
    for (const it of items) {
      const k = (
        it.status === "pending" ||
        it.status === "under_review" ||
        it.status === "approved" ||
        it.status === "rejected"
          ? it.status
          : "pending"
      ) as KycReviewStatus;
      out[k].push(it);
    }
    return out;
  }, [items]);

  const visibleItems = grouped[tab];
  const [selectedId, setSelectedId] = useState<string | null>(
    visibleItems[0]?.id ?? null,
  );

  // Keep selection in sync when the tab changes.
  // (Use the first item of the new tab, or null if empty.)
  function pickTab(v: KycReviewStatus) {
    setTab(v);
    setSelectedId(grouped[v][0]?.id ?? null);
  }

  const selected = visibleItems.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* ── Tabs (Pending / Under Review / Approved / Rejected) ── */}
      <Tabs
        value={tab}
        onValueChange={(v) => pickTab(v as KycReviewStatus)}
      >
        <TabsList className="inline-flex h-auto bg-transparent p-0">
          {TABS.map((t) => {
            const count = grouped[t.value].length;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className={cn(
                  "rounded-lg border border-transparent px-3 py-1.5 text-sm",
                  "data-[state=active]:border-border data-[state=active]:bg-card",
                  "data-[state=active]:font-semibold data-[state=active]:shadow-sm",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    count === 0
                      ? "bg-muted text-muted-foreground"
                      : t.value === "pending" || t.value === "under_review"
                        ? "bg-rose-500 text-white"
                        : "bg-emerald-500 text-white",
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* ── Split layout — queue on left, document viewer on right ── */}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT — queue list */}
        <div className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Queue
            </span>
            <span className="text-xs text-muted-foreground">
              {visibleItems.length} item
              {visibleItems.length === 1 ? "" : "s"}
            </span>
          </div>

          {visibleItems.length === 0 ? (
            <EmptyQueue tab={tab} />
          ) : (
            <ul className="divide-y divide-border overflow-y-auto lg:max-h-[640px]">
              {visibleItems.map((it) => (
                <QueueRow
                  key={it.id}
                  item={it}
                  selected={selectedId === it.id}
                  onPick={() => setSelectedId(it.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT — document viewer */}
        <div className="card-surface overflow-hidden">
          {selected ? (
            <ReviewPanel item={selected} />
          ) : (
            <EmptyViewer />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function EmptyQueue({ tab }: { tab: KycReviewStatus }) {
  const copy: Record<KycReviewStatus, string> = {
    pending: "Inbox zero. No submissions awaiting first review.",
    under_review: "No submissions in deep review right now.",
    approved: "No approved submissions yet.",
    rejected: "No rejections on file.",
  };
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
      <ShieldCheck className="h-6 w-6 opacity-50" />
      {copy[tab]}
    </div>
  );
}

function EmptyViewer() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <FileText className="h-5 w-5 text-indigo-600" />
      </div>
      <p className="font-medium">Select a submission</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Pick someone from the queue on the left to preview their documents and
        approve or reject.
      </p>
    </div>
  );
}

function QueueRow({
  item,
  selected,
  onPick,
}: {
  item: KycReviewItem;
  selected: boolean;
  onPick: () => void;
}) {
  const submittedDocCount = [
    !!item.pan_verified_at || !!item.pan_number,
    !!item.bank_verified_at || !!item.bank_account_number,
    !!item.selfie_url,
  ].filter(Boolean).length;

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "block w-full px-4 py-3 text-left transition-colors",
          selected
            ? "bg-indigo-50/60"
            : "hover:bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
              gradientFor(item.buyer_email),
            )}
          >
            {initials(item.buyer_full_name ?? item.buyer_email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {item.buyer_full_name ?? item.buyer_email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {item.buyer_email}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DocChip ok={!!(item.pan_verified_at || item.pan_number)} label="PAN" />
          <DocChip
            ok={!!(item.bank_verified_at || item.bank_account_number)}
            label="Bank"
          />
          <DocChip ok={!!item.selfie_url} label="Selfie" />
          <DocChip ok={!!item.id_document_url} label="ID" />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Submitted {formatDateTime(item.created_at)}</span>
          <span>{submittedDocCount}/3 docs</span>
        </div>

        {item.risk_flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.risk_flags.map((flag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                {flag}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}

function DocChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {ok ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      )}
      {label}
    </span>
  );
}

function ReviewPanel({ item }: { item: KycReviewItem }) {
  const reviewable =
    item.status === "pending" || item.status === "under_review";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                "bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                gradientFor(item.buyer_email),
              )}
            >
              {initials(item.buyer_full_name ?? item.buyer_email)}
            </span>
            <div className="min-w-0">
              <h2 className="font-sora text-lg font-semibold tracking-tight">
                {item.buyer_full_name ?? item.buyer_email}
              </h2>
              <Link
                href={`/admin/users/${item.user_id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Open user profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Level {item.level ?? 0}
            </span>
          </div>
        </div>

        {/* Contact strip */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {item.buyer_email}
          </span>
          {item.buyer_phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {item.buyer_phone}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <User2 className="h-3.5 w-3.5" />
            Submitted {formatDateTime(item.created_at)}
          </span>
        </div>
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {item.risk_flags.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Risk flags raised</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {item.risk_flags.map((flag, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center rounded-full border border-rose-300 bg-card px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-500/40 dark:text-rose-300"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {item.rejection_reason && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Previously rejected</p>
              <p className="mt-0.5">{item.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* PAN + Bank facts */}
        <div className="grid gap-4 md:grid-cols-2">
          <FactBlock icon={CreditCard} title="PAN details">
            <Fact k="Number" v={item.pan_number ?? "—"} mono />
            <Fact k="Name" v={item.pan_name ?? "—"} />
            <Fact
              k="Verified"
              v={item.pan_verified_at ? "Yes" : "Pending"}
              ok={!!item.pan_verified_at}
            />
          </FactBlock>
          <FactBlock icon={ShieldCheck} title="Bank details">
            <Fact k="Holder" v={item.bank_holder_name ?? "—"} />
            <Fact k="Account" v={item.bank_account_number ?? "—"} mono />
            <Fact k="IFSC" v={item.bank_ifsc ?? "—"} mono />
            <Fact
              k="Verified"
              v={item.bank_verified_at ? "Yes" : "Pending"}
              ok={!!item.bank_verified_at}
            />
          </FactBlock>
        </div>

        {/* Document previews */}
        <div className="grid gap-4 md:grid-cols-2">
          {item.selfie_url && (
            <DocPreview url={item.selfie_url} label="Selfie photo" />
          )}
          {item.id_document_url && (
            <DocPreview url={item.id_document_url} label="ID document" />
          )}
          {!item.selfie_url && !item.id_document_url && (
            <p className="md:col-span-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No document uploads on file for this submission.
            </p>
          )}
        </div>
      </div>

      {/* Footer — approve / reject actions */}
      <div className="border-t border-border bg-muted/20 px-6 py-4">
        {reviewable ? (
          <KycReviewActions submissionId={item.id} />
        ) : (
          <p className="text-xs text-muted-foreground">
            This submission is already{" "}
            <span className="font-medium capitalize">{item.status}</span> — no
            further action available here. Use the user&apos;s profile page for
            historical changes.
          </p>
        )}
      </div>
    </div>
  );
}

function FactBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Fact({
  k,
  v,
  mono,
  ok,
}: {
  k: string;
  v: string;
  mono?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "min-w-0 text-right",
          mono && "break-all font-mono text-xs",
          ok && "font-medium text-emerald-700",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function DocPreview({ url, label }: { url: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Eye className="h-3 w-3" />
          Open
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="aspect-video w-full bg-muted/40 object-contain"
      />
    </div>
  );
}
