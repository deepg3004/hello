// POST /api/buyer/logout — clear the buyer session cookie.

import { NextResponse } from "next/server";

import { BUYER_COOKIE } from "@/lib/buyer-portal";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: BUYER_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
