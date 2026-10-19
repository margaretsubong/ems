"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "../supabase/admin";
import { secureCookies } from "../supabase/config";
import { createSessionClient } from "../supabase/server";
import { authorizedAccount, dashboardFor, normalizeEmail, strongPassword, validProfile, validUsername, type AuthProfile } from "./policy";
import { applicationUrl, sendActivationEmail, sendAuthEmail } from "./email";
import { issueFlow, takeRateLimit, temporaryCredentials, verifiedFlow } from "./flows";
import { clearAuthCookies } from "./clear-cookies";

export type AuthResult = { success: boolean; error?: string; redirectTo?: string };
const unavailable = "Authentication is unavailable. Please try again later.";
const invalidLink = "This link is invalid, expired, or already used. Request a new link.";
const invalidLogin = "Invalid username, email, or password.";
const temporaryCredentialHours = 24;

async function loginEmail(identifier: string) {
  if (identifier.includes("@")) return authorizedAccount(identifier) ? normalizeEmail(identifier) : null;
  if (!validUsername(identifier)) return null;
  const { data, error } = await createAdminClient().from("employee_profiles").select("email").eq("username", identifier).maybeSingle();
  if (error) throw new Error("Authentication storage is unavailable.");
  return data && authorizedAccount(data.email) ? normalizeEmail(data.email) : null;
}

export async function login(identifier: string, password: string, remember = false): Promise<AuthResult> {
  if (typeof identifier !== "string" || typeof password !== "string" || identifier.length > 254 || password.length > 128 || !password || !identifier.trim()) return { success: false, error: invalidLogin };
  try {
    const normalized = await loginEmail(identifier.trim());
    if (!await takeRateLimit(`login:${normalized || identifier.trim().toLowerCase()}`, 10, 900)) return { success: false, error: "Too many login attempts. Try again in 15 minutes." };
    if (!normalized) return { success: false, error: invalidLogin };
    const client = await createSessionClient(remember === true);
    const { data, error } = await client.auth.signInWithPassword({ email: normalized, password });
    if (error || !data.user) return { success: false, error: invalidLogin };
    const { data: profile, error: profileError } = await client.from("employee_profiles").select("id,employee_id,email,username,role,account_status,activated_at").eq("id", data.user.id).maybeSingle();
    if (!profileError && validProfile(profile as AuthProfile | null, data.user) && profile?.account_status === "pending") {
      const expiresAt = Date.parse(String(data.user.app_metadata?.temp_credentials_expires_at ?? ""));
      const { data: claims, error: claimsError } = await client.auth.getClaims();
      const sessionId = claims?.claims.session_id;
      if (!(expiresAt > Date.now()) || claimsError || typeof sessionId !== "string") {
        await client.auth.signOut({ scope: "local" });
        await clearAuthCookies();
        return { success: false, error: "Your temporary credentials have expired. Request a new activation email." };
      }
      await issueFlow(data.user.id, sessionId, "activation");
      return { success: true, redirectTo: "/setup-account" };
    }
    if (profileError || !validProfile(profile as AuthProfile | null, data.user) || profile?.account_status !== "active" || !profile?.activated_at) {
      await client.auth.signOut({ scope: "local" });
      await clearAuthCookies();
      return { success: false, error: "Your account is not active. Complete account activation or contact your manager." };
    }
    const store = await cookies();
    store.delete("ems-auth-flow");
    store.set("ems-remember", remember === true ? "1" : "0", { ...secureCookies, ...(remember === true ? { maxAge: 60 * 60 * 24 * 30 } : {}) });
    return { success: true, redirectTo: dashboardFor(profile.role) };
  } catch { return { success: false, error: unavailable }; }
}

async function requestRecoveryEmail(email: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("employee_profiles").select("id,account_status").eq("email", email).maybeSingle();
  if (error) throw new Error("Authentication storage is unavailable.");
  if (!profile || profile.account_status !== "active") return false;
  if (!await takeRateLimit(`recovery:minute:${email}`, 1, 60) || !await takeRateLimit(`recovery:hour:${email}`, 5, 3600)) return false;
  const { data: existing, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || existing.user?.email?.toLowerCase() !== email) throw new Error("Provisioned identity does not match.");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (linkError || !link.properties?.hashed_token || link.user?.id !== profile.id) throw new Error("Could not generate verification link.");
  const url = new URL("/auth/confirm", applicationUrl());
  url.hash = new URLSearchParams({ token_hash: link.properties.hashed_token, type: "recovery", purpose: "recovery" }).toString();
  await sendAuthEmail(email, url.toString(), "recovery");
  return true;
}

export async function requestActivation(employeeId: string, email: string): Promise<AuthResult> {
  if (typeof employeeId !== "string" || typeof email !== "string" || email.length > 254) return { success: false, error: "Employee ID and email do not match an authorized account." };
  const normalized = normalizeEmail(email);
  const account = authorizedAccount(normalized);
  if (!account || employeeId.trim().toUpperCase() !== account.employeeId) return { success: false, error: "Employee ID and email do not match an authorized account." };
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin.from("employee_profiles").select("id,account_status").eq("email", normalized).maybeSingle();
    if (error || !profile) return { success: false, error: unavailable };
    if (profile.account_status === "active") return { success: false, error: "This account has already been activated. Please sign in instead." };
    if (profile.account_status !== "pending") return { success: false, error: "This account is unavailable. Contact your manager." };
    if (!await takeRateLimit(`activation:minute:${normalized}`, 1, 60) || !await takeRateLimit(`activation:hour:${normalized}`, 5, 3600)) return { success: false, error: "An activation request was made recently. Wait before requesting another email." };
    const { data: existing, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || existing.user?.email?.toLowerCase() !== normalized) return { success: false, error: unavailable };
    // Temporary credentials prove inbox ownership on first sign-in, so the email is confirmed here.
    const credentials = temporaryCredentials(account.employeeId);
    const expiresAt = new Date(Date.now() + temporaryCredentialHours * 3600 * 1000).toISOString();
    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { password: credentials.password, email_confirm: true, app_metadata: { temp_credentials_expires_at: expiresAt } });
    if (passwordError) return { success: false, error: unavailable };
    const { data: saved, error: saveError } = await admin.from("employee_profiles").update({ username: credentials.username }).eq("id", profile.id).eq("account_status", "pending").select("id").maybeSingle();
    if (saveError || !saved) return { success: false, error: unavailable };
    await sendActivationEmail(normalized, credentials.username, credentials.password, new URL("/login", applicationUrl()).toString(), temporaryCredentialHours);
    return { success: true };
  } catch { return { success: false, error: unavailable }; }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  after(async () => {
    try {
      if (typeof email === "string" && email.length <= 254) {
        const normalized = normalizeEmail(email);
        if (authorizedAccount(normalized)) await requestRecoveryEmail(normalized);
      }
    } catch {
      console.error("Password recovery request could not be completed. Check authentication storage and email provider availability.");
    }
  });
  return { success: true };
}

async function endSession(client: Awaited<ReturnType<typeof createSessionClient>>) {
  try {
    const { error } = await client.auth.signOut({ scope: "global" });
    if (error) console.error("Remote session revocation failed; local authentication cookies were cleared.");
  } catch {
    console.error("Remote session revocation failed; local authentication cookies were cleared.");
  } finally { await clearAuthCookies(); }
}

export async function verifyEmailLink(tokenHash: string, type: string, purpose: string): Promise<AuthResult> {
  if (typeof tokenHash !== "string" || !/^[a-f0-9]{32,128}$/i.test(tokenHash) || purpose !== "recovery" || type !== "recovery") return { success: false, error: invalidLink };
  try {
    if (!await takeRateLimit(`verify:${tokenHash}`, 5, 900)) return { success: false, error: invalidLink };
    const client = await createSessionClient(false);
    (await cookies()).delete("ems-auth-flow");
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error || !data.user || !data.session) return { success: false, error: invalidLink };
    const { data: profile, error: profileError } = await client.from("employee_profiles").select("id,employee_id,email,username,role,account_status,activated_at").eq("id", data.user.id).maybeSingle();
    if (profileError || !validProfile(profile as AuthProfile | null, data.user) || profile?.account_status !== "active") {
      await client.auth.signOut({ scope: "local" });
      return { success: false, error: invalidLink };
    }
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const sessionId = claims?.claims.session_id;
    if (claimsError || typeof sessionId !== "string") return { success: false, error: invalidLink };
    await issueFlow(data.user.id, sessionId, "recovery");
    return { success: true, redirectTo: "/reset-password" };
  } catch { return { success: false, error: unavailable }; }
}

export async function setupAccount(username: string, password: string, confirmation: string): Promise<AuthResult> {
  if (typeof username !== "string" || !validUsername(username.trim())) return { success: false, error: "Username must contain 3–40 letters, numbers, dots, hyphens, or underscores." };
  if (typeof password !== "string" || !strongPassword(password) || password !== confirmation) return { success: false, error: "Passwords must match and meet all password requirements." };
  const expired = "Your session expired. Sign in again with your temporary credentials.";
  try {
    const pending = await verifiedFlow("activation");
    if (!pending) return { success: false, error: expired };
    if (username.trim() === pending.profile.username) return { success: false, error: "Choose a new username different from your temporary username." };
    const admin = createAdminClient();
    const { data: taken, error: takenError } = await admin.from("employee_profiles").select("id").eq("username", username.trim()).maybeSingle();
    if (takenError) return { success: false, error: unavailable };
    if (taken && taken.id !== pending.user.id) return { success: false, error: "This username is already taken. Choose another." };
    const context = await verifiedFlow("activation", true);
    if (!context) return { success: false, error: expired };
    const { error } = await context.client.auth.updateUser({ password });
    if (error) {
      await endSession(context.client);
      return { success: false, error: error.code === "same_password" ? "Choose a password different from your temporary password. Sign in again with your temporary credentials." : "Password could not be saved. Sign in again with your temporary credentials and try again." };
    }
    const { data, error: activationError } = await admin.from("employee_profiles").update({ username: username.trim(), account_status: "active", activated_at: new Date().toISOString() }).eq("id", context.user.id).eq("account_status", "pending").select("id").maybeSingle();
    if (!activationError && data) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(context.user.id, { app_metadata: { temp_credentials_expires_at: null } });
      if (metadataError) console.error("Temporary credential expiry could not be cleared after activation.");
    }
    await endSession(context.client);
    if (activationError || !data) return { success: false, error: "Setup could not be completed. Request a new activation email." };
    return { success: true };
  } catch { return { success: false, error: unavailable }; }
}

export async function resetPassword(password: string, confirmation: string): Promise<AuthResult> {
  if (typeof password !== "string" || !strongPassword(password) || password !== confirmation) return { success: false, error: "Passwords must match and meet all password requirements." };
  try {
    const context = await verifiedFlow("recovery", true);
    if (!context) return { success: false, error: invalidLink };
    const { error } = await context.client.auth.updateUser({ password });
    await endSession(context.client);
    if (error) return { success: false, error: "Password could not be reset. Request another recovery link and try again." };
    return { success: true };
  } catch { return { success: false, error: unavailable }; }
}

export async function logout() {
  const client = await createSessionClient();
  try {
    const { data: { user } } = await client.auth.getUser();
    if (user) await createAdminClient().from("auth_flows").delete().eq("user_id", user.id);
  } catch { console.error("Credential proof cleanup could not be completed."); }
  await endSession(client);
  redirect("/login");
}
