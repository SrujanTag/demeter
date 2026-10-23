import { NextResponse } from "next/server";
import { makeSignature } from "better-auth/crypto";
import { getAuth } from "@/lib/server/auth";
import { getAuthConfig } from "@/lib/server/env";
import { getDb } from "@/lib/server/db/client";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  if (process.env.APP_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Dev login is only available in development mode." }, { status: 403 });
  }

  const db = await getDb();
  let seller = await db.collection("sellers").findOne({ status: "active" });

  const userId = seller?.ownerUserId || "demo-owner";

  // Ensure user record exists
  await db.collection("user").updateOne(
    { id: userId },
    {
      $set: {
        _id: userId,
        id: userId,
        name: "Demo Kitchen Owner",
        email: "owner@tiffining.local",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // If no seller exists, provision a default demo seller
  if (!seller) {
    const defaultSeller = {
      _id: crypto.randomUUID(),
      ownerUserId: userId,
      settings: {
        timezone: "Asia/Kolkata",
        weekdays: [1, 2, 3, 4, 5, 6],
        quantityCap: 100,
        customerCap: 100,
        planningTime: "09:00",
        cutoffTime: "10:00",
      },
      stateRevision: 0,
      status: "active",
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };
    await db.collection("sellers").insertOne(defaultSeller);
    seller = defaultSeller;
  }

  const auth = await getAuth();
  const ctx = await (auth as unknown as { $context: Promise<{ internalAdapter: { createSession: (userId: string) => Promise<{ token: string; expiresAt: Date }> } }> }).$context;
  const session = await ctx.internalAdapter.createSession(userId);
  const config = getAuthConfig();
  const signature = await makeSignature(session.token, config.secret);
  const cookieValue = `${session.token}.${signature}`;

  const response = NextResponse.json({ ok: true, redirect: "/dashboard" });
  response.cookies.set("better-auth.session_token", cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 30 * 86400,
  });

  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  const postRes = await POST();
  if (postRes.status !== 200) return postRes;

  const url = new URL(request.url);
  const redirectUrl = new URL("/dashboard", url.origin);
  const res = NextResponse.redirect(redirectUrl);
  
  // Copy cookie to redirect response
  const cookie = postRes.cookies.get("better-auth.session_token");
  if (cookie) {
    res.cookies.set("better-auth.session_token", cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  return res;
}
