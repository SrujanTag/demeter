import { writeFile } from "node:fs/promises";
import { makeSignature } from "better-auth/crypto";
import { getAuth } from "../lib/server/auth";
import { getAuthConfig } from "../lib/server/env";
import { getDb } from "../lib/server/db/client";
import { run } from "./run";

void run(async () => {
  const db = await getDb();
  const seller = await db.collection("sellers").findOne({ status: "active" });
  if (!seller) {
    console.error("No active seller found. Run pnpm seed:demo first.");
    process.exit(1);
  }
  const userId = seller.ownerUserId;

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

  const auth = await getAuth();
  const ctx = await (auth as unknown as { $context: Promise<{ internalAdapter: { createSession: (userId: string) => Promise<{ token: string; expiresAt: Date }> } }> }).$context;
  const session = await ctx.internalAdapter.createSession(userId);
  const config = getAuthConfig();
  const signature = await makeSignature(session.token, config.secret);
  const cookieValue = `better-auth.session_token=${session.token}.${signature}`;

  await writeFile(".demo-cookie", cookieValue, "utf8");

  console.log("==================================================");
  console.log("Authenticated Session Generated Successfully!");
  console.log(`Owner User ID: ${userId}`);
  console.log(`Seller ID:    ${seller._id}`);
  console.log("Cookie saved to .demo-cookie");
  console.log("==================================================");
  console.log("\nCookie header for curl or browser:");
  console.log(cookieValue);
  console.log("\nQuick test command:");
  console.log(`curl -s -H "Cookie: ${cookieValue}" http://localhost:3000/api/v1/me | jq .`);
});
