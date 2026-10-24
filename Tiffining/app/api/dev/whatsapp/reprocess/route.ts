import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { handleIncomingWhatsAppMessage } from "@/lib/server/whatsapp";
import { getSessionState } from "@/lib/server/whatsapp-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      from?: string;
      profileName?: string;
      messageId?: string;
    };

    const text = body.text || "Bhaiyya Monday ko 3 tiffin chahiye hoga please";
    const from = body.from || "19507892510916";
    const profileName = body.profileName || "Mom";
    const messageId = body.messageId || `msg_reprocess_${Date.now()}`;

    const db = await getDb();
    const seller = await db.collection("sellers").findOne({});
    if (!seller) {
      return NextResponse.json({ ok: false, error: "No seller found" }, { status: 404 });
    }

    const result = await handleIncomingWhatsAppMessage({
      phoneNumberId: "qr_web",
      from,
      profileName,
      messageId,
      text,
      timestamp: String(Math.floor(Date.now() / 1000)),
    });

    // If socket is connected and reply text was generated, send it directly!
    const session = getSessionState(seller._id);
    let replySent = false;
    let replyError: string | null = null;

    if (session.sock && result.replyText) {
      try {
        // Try both @s.whatsapp.net for the phone and @lid if available
        await session.sock.sendMessage("919026581007@s.whatsapp.net", {
          text: result.replyText,
        });
        replySent = true;
      } catch (err) {
        replyError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json({
      ok: true,
      result,
      replySent,
      replyError,
      socketStatus: session.status,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
