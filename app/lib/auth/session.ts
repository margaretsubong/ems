import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "../supabase/server";
import { dashboardFor, validProfile, type AuthProfile, type Role } from "./policy";

export async function getAuthContext() {
  const client = await createSessionClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data, error: profileError } = await client.from("employee_profiles").select("id,employee_id,email,username,role,account_status,activated_at").eq("id", user.id).maybeSingle();
  const profile = data as AuthProfile | null;
  if (profileError || !validProfile(profile, user)) return null;
  return { client, user, profile: profile! };
}

export async function requirePortal(role: Role) {
  const context = await getAuthContext();
  if (!context || context.profile.account_status !== "active" || !context.profile.activated_at) redirect("/login");
  if (context.profile.role !== role) redirect(dashboardFor(context.profile.role));
  return context;
}
