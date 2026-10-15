"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle } from "lucide-react";
import FormInput from "@/app/components/FormInput";
import PasswordStrength from "@/app/components/PasswordStrength";
import { getPasswordStrength } from "@/app/components/PasswordStrength";
import EMSLogo from "@/app/components/EMSLogo";
import { resetPassword } from "@/app/lib/auth/actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess) return;
    const timeout = setTimeout(() => { router.replace("/login"); router.refresh(); }, 2000);
    return () => clearTimeout(timeout);
  }, [isSuccess, router]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = "New password is required.";
    } else {
      const strength = getPasswordStrength(password);
      if (strength.score < 5) {
        newErrors.password =
          "Password is too weak. Please meet the requirements below.";
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
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
      const result = await resetPassword(password, confirmPassword);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setGeneralError(
          result.error || "Password reset failed. Please try again."
        );
      }
    } catch {
      setGeneralError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Password Reset Successful
        </h1>
        <p className="text-sm text-gray-600 mb-6 max-w-sm">
          Your password has been successfully reset. You can now sign in with
          your new password.
        </p>
        <Link
          href="/login"
          className="flex h-11 w-full max-w-xs items-center justify-center rounded-lg bg-[#6554F4] text-white font-medium text-sm transition-colors hover:bg-[#5240E3] focus-ring shadow-sm"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <EMSLogo className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your new password below.
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
        <div>
          <FormInput
            id="reset-password"
            label="New Password"
            type="password"
            placeholder="Create a strong password"
            value={password}
            onChange={(val) => {
              setPassword(val);
              if (errors.password)
                setErrors((prev) => ({ ...prev, password: "" }));
            }}
            error={errors.password}
            required
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
        </div>

        <FormInput
          id="reset-confirm-password"
          label="Confirm New Password"
          type="password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(val) => {
            setConfirmPassword(val);
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: "" }));
          }}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
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
            "Reset Password"
          )}
        </button>
      </form>
    </div>
  );
}
