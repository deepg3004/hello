"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { StickyCheckoutBar } from "./shared/StickyCheckoutBar";
import type { BaseTemplateProps } from "./shared/types";

interface Benefit { text: string }

export interface TelegramVipPageProps extends BaseTemplateProps {
  group_name: string;
  group_avatar?: string;
  members_label?: string;
  what_shared?: string;
  benefits_title?: string;
  benefits_items?: Benefit[];
  join_title?: string;
  join_note?: string;
}

export function TelegramVipPage(props: TelegramVipPageProps) {
  const benefits = props.benefits_items ?? [];
  const sharedItems = (props.what_shared ?? "")
    .split(/[•·\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // After checkout success the buyer is redirected to /order/[id]?status=success.
  // On reload of this page with ?invite=... we surface the join link.
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const inv = sp.get("invite");
    if (inv) setInviteLink(inv);
  }, []);

  const [open, setOpen] = useState(false);
  const price = props.product?.price ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100">
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-10 text-center">
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-[#0088cc] bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {props.group_avatar ? (
            <img
              src={props.group_avatar}
              alt={props.group_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#0088cc]">
              {props.group_name?.[0] ?? "T"}
            </div>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">{props.group_name}</h1>
        {props.members_label && (
          <p className="mt-1 text-sm text-[#0088cc]">{props.members_label}</p>
        )}
        {sharedItems.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {sharedItems.map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-zinc-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <Button
          className="mt-8 bg-[#0088cc] text-white hover:bg-[#0099e0]"
          onClick={() => setOpen(true)}
        >
          <Send className="mr-2 h-4 w-4" />
          Join VIP Group
        </Button>
      </section>

      {benefits.length > 0 && (
        <section className="border-t border-white/5 py-12">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {props.benefits_title}
            </h2>
            <ul className="mt-6 space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#0088cc]" />
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section
        id="join"
        className="scroll-mt-16 border-t border-white/5 bg-slate-900 pb-32 pt-16 md:pb-16"
      >
        <div className="mx-auto max-w-3xl px-6">
          {props.join_title && (
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              {props.join_title}
            </h2>
          )}
          {props.join_note && (
            <p className="mt-2 text-center text-sm text-zinc-400">
              {props.join_note}
            </p>
          )}

          {/* If we already have an invite link from the URL, surface it */}
          {inviteLink ? (
            <div className="mx-auto mt-8 max-w-md rounded-xl bg-emerald-50 p-6 text-emerald-900">
              <p className="text-sm font-semibold">Payment confirmed 🎉</p>
              <p className="mt-1 text-sm">Tap below to join the group in Telegram.</p>
              <Button asChild className="mt-4 w-full bg-[#0088cc] hover:bg-[#0099e0]">
                <a href={inviteLink} target="_blank" rel="noreferrer">
                  Open Telegram <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          ) : (
            <div className="mt-8 rounded-xl bg-white p-6 text-zinc-900 shadow-2xl">
              {props.pageId && props.product && !props.isPreview ? (
                <CheckoutForm
                  pageId={props.pageId}
                  productId={props.product.id}
                  productName={props.product.name}
                  productDescription={props.product.description}
                  productImage={props.product.image_url}
                  price={Number(props.product.price)}
                  currency={props.product.currency}
                orderBump={props.bumpRuntime ? { ...props.bumpRuntime, ready: true } : undefined}
                />
              ) : (
                <p className="text-center text-sm text-zinc-500">
                  {props.isPreview
                    ? "Checkout form renders on the live page."
                    : "Attach a product to this page to enable checkout."}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modal — also opens the checkout, useful from the hero CTA. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Join {props.group_name}</DialogTitle>
          </DialogHeader>
          {props.pageId && props.product && !props.isPreview ? (
            <CheckoutForm
              pageId={props.pageId}
              productId={props.product.id}
              productName={props.product.name}
              productDescription={props.product.description}
              productImage={props.product.image_url}
              price={Number(props.product.price)}
              currency={props.product.currency}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {props.isPreview
                ? "Checkout form renders on the live page."
                : "Attach a product to enable checkout."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <StickyCheckoutBar
        targetId="join"
        priceLabel={price ? `₹${price.toLocaleString("en-IN")}` : "Join"}
        cta="Join"
        buttonClassName="bg-[#0088cc] text-white"
      />
    </div>
  );
}
