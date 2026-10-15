"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle } from "lucide-react";
import FormInput from "@/app/components/FormInput";
import PasswordStrength from "@/app/components/PasswordStrength";
import { getPasswordStrength } from "@/app/components/PasswordStrength";
import EMSLogo from "@/app/components/EMSLogo";
import { setupAccount } from "@/app/lib/auth/actions";

export default function SetupAccountPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = "Username is required.";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters.";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      newErrors.username =
        "Username can only contain letters, numbers, dots, hyphens, and underscores.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else {
      const strength = getPasswordStrength(password);
      if (strength.score < 5) {
        newErrors.password =
          "Password is too weak. Please meet the requirements below.";
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
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
      const result = await setupAccount(username, password, confirmPassword);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setGeneralError(
          result.error || "Account setup failed. Please try again."
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
          Account Activated!
        </h1>
        <p className="text-sm text-gray-600 mb-6 max-w-sm">
          Your account has been successfully set up. You can now sign in with
          your new credentials.
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
        <h1 className="text-2xl font-bold text-gray-900">
          Set up your account
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Create your username and password to complete activation.
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
          id="setup-username"
          label="Username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(val) => {
            setUsername(val);
            if (errors.username)
              setErrors((prev) => ({ ...prev, username: "" }));
          }}
          error={errors.username}
          required
          autoComplete="username"
        />

        <div>
          <FormInput
            id="setup-password"
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
          id="setup-confirm-password"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
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
            "Save & Continue"
          )}
        </button>
      </form>
    </div>
  );
}
