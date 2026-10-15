"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import FormInput from "@/app/components/FormInput";
import EMSLogo from "@/app/components/EMSLogo";
import { requestPasswordReset } from "@/app/lib/auth/actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Company email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.success) {
        setIsSuccess(true);
      }
    } catch {
      // Still show success to avoid email enumeration
      setIsSuccess(true);
    } finally {
      setIsLoading(false);
    }
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEEBFF]">
          <Mail className="h-8 w-8 text-[#6554F4]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Check your email
        </h1>
        <p className="text-sm text-gray-600 mb-2 max-w-sm">
          If this email belongs to an active account, password reset instructions will be sent to:
        </p>
        <p className="text-sm font-semibold text-gray-900 mb-4">{email}</p>
        <p className="text-xs text-gray-500 mb-6 max-w-sm">
          If you don&apos;t see the email, check your spam folder. The link will
          expire according to your organization&apos;s security policy.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6554F4] hover:text-[#5240E3] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <EMSLogo className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Forgot password?</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your company email and we&apos;ll send you instructions to reset
          your password.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormInput
          id="forgot-email"
          label="Company Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(val) => {
            setEmail(val);
            if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
          }}
          error={errors.email}
          required
          autoComplete="email"
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#6554F4] text-white font-medium text-sm transition-colors hover:bg-[#5240E3] disabled:opacity-60 disabled:cursor-not-allowed focus-ring shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Send Reset Link"
          )}
        </button>
      </form>

      {/* Back to sign in */}
      <div className="mt-6 flex justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6554F4] hover:text-[#5240E3] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
