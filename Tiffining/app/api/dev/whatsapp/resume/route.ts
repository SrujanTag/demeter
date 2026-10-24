import { NextResponse } from "next/server";
import { restoreActiveWhatsAppSessions, getSessionState } from "@/lib/server/whatsapp-web";
import { getDb } from "@/lib/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const seller = await db.collection("sellers").findOne({});
  if (!seller) {
    return NextResponse.json({ ok: false, error: "No seller found" }, { status: 404 });
  }

  await restoreActiveWhatsAppSessions();
  const session = getSessionState(seller._id);

  return NextResponse.json({
    ok: true,
    sellerId: seller._id,
    status: session.status,
    phoneNumber: session.phoneNumber,
    lastError: session.lastError,
  });
}
