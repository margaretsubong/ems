import { redirect } from "next/navigation";
import { verifiedFlow } from "@/app/lib/auth/flows";
import ResetPasswordForm from "./ResetPasswordForm";
import { Suspense } from "react";

async function VerifiedRecovery() {
  if (!await verifiedFlow("recovery")) redirect("/forgot-password?error=verification-required");
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<p className="text-sm text-gray-600">Verifying recovery link…</p>}><VerifiedRecovery /></Suspense>;
}
