import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { appUrl } from "@/lib/stripe";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.redirect(`${appUrl()}/`, { status: 303 });
}
