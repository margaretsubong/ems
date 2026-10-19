import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { secureCookies, supabaseConfig } from "./app/lib/supabase/config";
import { dashboardFor, validProfile, type AuthProfile } from "./app/lib/auth/policy";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  try {
    const { url, key } = supabaseConfig();
    const client = createServerClient(url, key, {
      cookieOptions: secureCookies,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          for (const { name, value } of values) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.headers.set("Cache-Control", "private, no-store");
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
          for (const { name, value, options } of values) {
            const settings = { ...options, ...secureCookies };
            if (request.cookies.get("ems-remember")?.value !== "1" && options.maxAge !== 0) { delete settings.maxAge; delete settings.expires; }
            response.cookies.set(name, value, settings);
          }
        },
      },
    });
    const { data: { user }, error } = await client.auth.getUser();
    const path = request.nextUrl.pathname;
    const portal = path === "/employee" || path.startsWith("/employee/") || path === "/manager" || path.startsWith("/manager/");
    if (!portal) {
      if (!error && user && request.cookies.get("ems-auth-flow")?.value) return response;
      const destination = path === "/setup-account" ? "/login" : "/forgot-password?error=verification-required";
      const redirected = NextResponse.redirect(new URL(destination, request.url));
      for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie);
      redirected.headers.set("Cache-Control", "private, no-store");
      return redirected;
    }
    let destination: string | null = null;
    if (error || !user) destination = "/login";
    else {
      const { data, error: profileError } = await client.from("employee_profiles").select("id,employee_id,email,username,role,account_status,activated_at").eq("id", user.id).maybeSingle();
      const profile = data as AuthProfile | null;
      if (profileError || !validProfile(profile, user) || profile?.account_status !== "active" || !profile.activated_at) destination = "/login";
      else if ((path.startsWith("/manager") ? "department_manager" : "employee") !== profile.role) destination = dashboardFor(profile.role);
    }
    if (!destination) return response;
    const redirected = NextResponse.redirect(new URL(destination, request.url));
    for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie);
    redirected.headers.set("Cache-Control", "private, no-store");
    return redirected;
  } catch {
    const unavailable = NextResponse.redirect(new URL("/login?error=service-unavailable", request.url));
    unavailable.headers.set("Cache-Control", "private, no-store");
    return unavailable;
  }
}

export const config = { matcher: ["/employee/:path*", "/manager/:path*", "/setup-account", "/reset-password"] };
