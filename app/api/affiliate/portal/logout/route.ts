import { NextResponse } from "next/server";

import { PORTAL_COOKIE } from "@/lib/affiliate";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: PORTAL_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
