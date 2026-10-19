"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import FormInput from "@/app/components/FormInput";
import EMSLogo from "@/app/components/EMSLogo";
import { login } from "@/app/lib/auth/actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Username or email is required.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");

    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await login(email, password, rememberMe);
      if (result.success) {
        // Navigate after successful login
        router.replace(result.redirectTo || "/login");
        router.refresh();
      } else {
        setGeneralError(result.error || "Login failed. Please try again.");
      }
    } catch {
      setGeneralError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <EMSLogo className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-600 mt-1">
          Sign in to your employee account to continue.
        </p>
      </div>

      {/* General error */}
      {generalError && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"
          role="alert"
        >
          {generalError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormInput
          id="login-email"
          label="Username or Email"
          type="text"
          placeholder="Username or you@company.com"
          value={email}
          onChange={(val) => {
            setEmail(val);
            if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
          }}
          error={errors.email}
          required
          autoComplete="username"
        />

        <FormInput
          id="login-password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(val) => {
            setPassword(val);
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: "" }));
          }}
          error={errors.password}
          required
          autoComplete="current-password"
        />

        {/* Remember me & Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#6554F4] focus:ring-[#6554F4] accent-[#6554F4]"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#6554F4] hover:text-[#5240E3] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#6554F4] text-white font-medium text-sm transition-colors hover:bg-[#5240E3] disabled:opacity-60 disabled:cursor-not-allowed focus-ring shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Activate account link */}
      <p className="mt-6 text-center text-sm text-gray-600">
        First time employee?{" "}
        <Link
          href="/activate-account"
          className="font-semibold text-[#6554F4] hover:text-[#5240E3] transition-colors"
        >
          Activate Account
        </Link>
      </p>
    </div>
  );
}
