"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import FormInput from "@/app/components/FormInput";
import EMSLogo from "@/app/components/EMSLogo";
import { requestActivation } from "@/app/lib/auth/actions";

export default function ActivateAccountPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!employeeId.trim()) {
      newErrors.employeeId = "Employee ID is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Company email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid company email address.";
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
      const result = await requestActivation(employeeId, email);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setGeneralError(result.error || "Verification failed. Please try again.");
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
        <h1 className="text-2xl font-bold text-gray-900">
          Activate your account
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your employee details to verify and activate your account.
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

      {isSuccess && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">Check your email for a secure activation link. Your employee details alone do not activate your account.</p>}
      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormInput
          id="activate-employee-id"
          label="Employee ID"
          type="text"
          placeholder="e.g. EMP-001"
          value={employeeId}
          onChange={(val) => {
            setEmployeeId(val);
            if (errors.employeeId)
              setErrors((prev) => ({ ...prev, employeeId: "" }));
          }}
          error={errors.employeeId}
          required
        />

        <FormInput
          id="activate-email"
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
          disabled={isLoading || isSuccess}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#6554F4] text-white font-medium text-sm transition-colors hover:bg-[#5240E3] disabled:opacity-60 disabled:cursor-not-allowed focus-ring shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Verify Account"
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
