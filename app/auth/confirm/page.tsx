"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { verifyEmailLink, type AuthResult } from "@/app/lib/auth/actions";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const verification = useRef<Promise<AuthResult> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.hash.slice(1));
    verification.current ??= verifyEmailLink(params.get("token_hash") || "", params.get("type") || "", params.get("purpose") || "");
    verification.current.then((result) => {
      if (cancelled) return;
      if (result.success && result.redirectTo) {
        window.history.replaceState(null, "", "/auth/confirm");
        router.replace(result.redirectTo);
        router.refresh();
      } else setError(result.error || "Verification failed. Request a new link.");
    }).catch(() => {
      if (!cancelled) setError("Verification failed. Please try again or request a new link.");
    });
    return () => { cancelled = true; };
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center bg-[#f5f4fa] p-6"><section className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">{error ? "Email verification failed" : "Verifying your email…"}</h1>{error ? <><p className="mt-4 text-sm text-red-700" role="alert">{error}</p><div className="mt-5 flex flex-wrap gap-4 text-sm text-[#6554f4]"><button onClick={() => window.location.reload()}>Try again</button><Link href="/activate-account">Request activation</Link><Link href="/forgot-password">Request password reset</Link></div></> : <p className="mt-3 text-sm text-gray-600" role="status">Please wait. Your credentials form will open automatically after verification.</p>}<Link href="/login" className="mt-5 block text-sm text-[#6554f4]">Back to Sign In</Link></section></main>;
}
