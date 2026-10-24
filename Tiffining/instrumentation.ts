export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { restoreActiveWhatsAppSessions } = await import("@/lib/server/whatsapp-web");
      await restoreActiveWhatsAppSessions();
      console.log("[INSTRUMENTATION] WhatsApp Web sessions restored on server startup.");
    } catch (err) {
      console.error("[INSTRUMENTATION] Failed to restore WhatsApp sessions:", err);
    }
  }
}
