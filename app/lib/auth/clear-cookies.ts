import "server-only";
import { cookies } from "next/headers";
import { supabaseConfig } from "../supabase/config";

export async function clearAuthCookies() {
  const store = await cookies();
  const { url } = supabaseConfig();
  const prefix = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  for (const cookie of store.getAll()) {
    if (cookie.name === prefix || cookie.name.startsWith(`${prefix}.`) || cookie.name === `${prefix}-code-verifier`) store.delete(cookie.name);
  }
  store.delete("ems-auth-flow");
  store.delete("ems-remember");
}
