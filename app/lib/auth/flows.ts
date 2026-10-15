import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "../supabase/admin";
import { secureCookies } from "../supabase/config";
import { getAuthContext } from "./session";

export type FlowPurpose = "activation" | "recovery";
export function hashValue(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function takeRateLimit(key: string, limit: number, seconds: number) {
  const { data, error } = await createAdminClient().rpc("take_auth_rate_limit", {
    key_value: hashValue(key), max_attempts: limit, window_seconds: seconds,
  });
  if (error) throw new Error("Authentication security storage is unavailable.");
  return data === true;
}

export async function issueFlow(userId: string, sessionId: string, purpose: FlowPurpose) {
  const admin = createAdminClient();
  const nonce = randomBytes(32).toString("base64url");
  const { error } = await admin.from("auth_flows").insert({ nonce_hash: hashValue(nonce), user_id: userId, session_id: sessionId, purpose });
  if (error) throw new Error("Could not establish a secure verification flow.");
  (await cookies()).set("ems-auth-flow", nonce, { ...secureCookies, maxAge: 900 });
}

export async function verifiedFlow(purpose: FlowPurpose, consume = false) {
  const context = await getAuthContext();
  const nonce = (await cookies()).get("ems-auth-flow")?.value;
  if (!context || !nonce) return null;
  if (purpose === "activation" ? context.profile.account_status !== "pending" : context.profile.account_status !== "active") return null;
  const { data, error } = await context.client.auth.getClaims();
  const sessionId = data?.claims.session_id;
  if (error || typeof sessionId !== "string") return null;
  const admin = createAdminClient();
  if (consume) {
    const { data: consumed, error: consumeError } = await admin.rpc("consume_auth_flow", {
      nonce_value: hashValue(nonce), user_value: context.user.id, session_value: sessionId, purpose_value: purpose,
    });
    if (consumeError || consumed !== true) return null;
  } else {
    const { data: flow, error: flowError } = await admin.from("auth_flows").select("nonce_hash").eq("nonce_hash", hashValue(nonce)).eq("user_id", context.user.id).eq("session_id", sessionId).eq("purpose", purpose).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (flowError || !flow) return null;
  }
  return context;
}
