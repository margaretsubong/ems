import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { authorizedAccounts } from "../app/lib/auth/policy.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Existing Supabase server environment variables are required.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(`Supabase project: ${new URL(url).hostname}`);
const existing = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(`User inspection failed (${error.status || "unknown"}).`);
  existing.push(...data.users);
  if (data.users.length < 100) break;
}
if (existing.some((user) => !authorizedAccounts.some((account) => account.email === user.email?.toLowerCase()))) {
  throw new Error("Unexpected existing Auth users found. No changes made; review project identity before provisioning.");
}
for (const account of authorizedAccounts) {
  const user = existing.find((entry) => entry.email?.toLowerCase() === account.email);
  if (user) {
    console.log(`${account.employeeId}: already provisioned; credentials unchanged.`);
    continue;
  }
  const { error } = await client.auth.admin.createUser({ email: account.email, email_confirm: false });
  if (error) throw new Error(`${account.employeeId}: provisioning failed (${error.status || "unknown"}).`);
  console.log(`${account.employeeId}: provisioned without password or verified email. No email sent.`);
}
const { error } = await client.from("employee_profiles").select("id").limit(1);
console.log(error ? "Authentication schema is not ready. Apply the prepared auth migration before using the application." : "Authentication schema is accessible.");
