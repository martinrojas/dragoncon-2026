import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { hashPassword } from "../../../lib/auth";
import { authenticators, users } from "../../../db/schema";

const RP_NAME = "Dragon Con 2026 Planner";

function getRpId(reqUrl: string): string {
  const host = new URL(reqUrl, "http://localhost").hostname;
  return host === "localhost" || host === "127.0.0.1" ? host : host;
}


export const POST = defineHandler(async (c: Context) => {
  try {
    const action = c.req.query("action");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rpID = getRpId(c.req.url);

    // 1a. Generate Registration Options (existing user)
    if (action === "generate-register-options") {
      const userId = body.userId as string;
      const username = body.username as string;
      if (!userId || !username) {
        return c.json({ success: false, error: "userId and username required" }, 400);
      }

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: new TextEncoder().encode(userId),
        userName: username,
        userDisplayName: username,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "discouraged",
        },
      });

      return c.json({ success: true, options });
    }

    // 1b. Quick Register (Create User + Options)
    if (action === "quick-register-options") {
      const username = (body.username as string)?.trim().toLowerCase();
      const name = (body.name as string)?.trim() || username;

      if (!username) {
        return c.json({ success: false, error: "Username is required" }, 400);
      }

      let [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) {
        const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();
        const pwdHash = await hashPassword(crypto.randomUUID());

        await db.insert(users).values({
          id: userId,
          username,
          name,
          passwordHash: pwdHash,
          createdAt: now,
        });

        [user] = await db.select().from(users).where(eq(users.id, userId));
      }

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.username,
        userDisplayName: user.name,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "discouraged",
        },
      });

      return c.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
        options,
      });
    }

    // 2. Verify Registration Response
    if (action === "verify-register") {
      const userId = body.userId as string;
      const registrationResponse = body.registrationResponse as any;
      const expectedChallenge = body.expectedChallenge as string;

      if (!userId || !registrationResponse || !expectedChallenge) {
        return c.json({ success: false, error: "Missing verification parameters" }, 400);
      }

      const origin = new URL(c.req.url, "http://localhost").origin;

      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        const now = new Date().toISOString();
        const id = `auth_${crypto.randomUUID().slice(0, 8)}`;

        const pubKeyBase64 = Buffer.from(credential.publicKey).toString("base64url");

        await db.insert(authenticators).values({
          id,
          userId,
          credentialId: credential.id,
          publicKey: pubKeyBase64,
          counter: credential.counter,
          createdAt: now,
        });

        const [user] = await db.select().from(users).where(eq(users.id, userId));
        const token = user
          ? btoa(JSON.stringify({ id: user.id, username: user.username, name: user.name, role: "user" }))
          : "";

        return c.json({
          success: true,
          message: "Passkey registered successfully!",
          user: user ? { id: user.id, username: user.username, name: user.name, role: "user" } : null,
          token,
        });
      }

      return c.json({ success: false, error: "Verification failed" }, 400);
    }

    // 3. Generate Login Options
    if (action === "generate-login-options") {
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "discouraged",
      });

      return c.json({ success: true, options });
    }

    // 4. Verify Login Response (1-Click Passkey Login)
    if (action === "verify-login") {
      const assertionResponse = body.assertionResponse as any;
      const expectedChallenge = body.expectedChallenge as string;

      if (!assertionResponse || !expectedChallenge) {
        return c.json({ success: false, error: "Missing login assertion parameters" }, 400);
      }

      const credentialId = assertionResponse.id;
      const [authRecord] = await db
        .select()
        .from(authenticators)
        .where(eq(authenticators.credentialId, credentialId));

      if (!authRecord) {
        return c.json({ success: false, error: "Passkey not recognized" }, 404);
      }

      const [user] = await db.select().from(users).where(eq(users.id, authRecord.userId));
      if (!user) {
        return c.json({ success: false, error: "User associated with passkey not found" }, 404);
      }

      const origin = new URL(c.req.url, "http://localhost").origin;
      const publicKeyBuffer = Buffer.from(authRecord.publicKey, "base64url");

      const verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: authRecord.credentialId,
          publicKey: publicKeyBuffer,
          counter: authRecord.counter,
        },
      });

      if (verification.verified) {
        await db
          .update(authenticators)
          .set({ counter: verification.authenticationInfo.newCounter })
          .where(eq(authenticators.id, authRecord.id));

        const token = btoa(
          JSON.stringify({ id: user.id, username: user.username, name: user.name, role: user.role }),
        );

        return c.json({
          success: true,
          user: { id: user.id, username: user.username, name: user.name, role: user.role },
          token,
        });
      }

      return c.json({ success: false, error: "Passkey authentication failed" }, 400);
    }

    return c.json({ success: false, error: "Invalid passkey action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
