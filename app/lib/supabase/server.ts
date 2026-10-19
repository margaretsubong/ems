import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { secureCookies, supabaseConfig } from "./config";

export async function createSessionClient(remember?: boolean) {
  await connection();
  const store = await cookies();
  const { url, key } = supabaseConfig();
  const persist = remember ?? store.get("ems-remember")?.value === "1";
  return createServerClient(url, key, {
    cookieOptions: secureCookies,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) {
            const settings = { ...options, ...secureCookies };
            if (!persist && options.maxAge !== 0) { delete settings.maxAge; delete settings.expires; }
            store.set(name, value, settings);
          }
        } catch {
        }
      },
    },
  });
}
