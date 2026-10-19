import { redirect } from "next/navigation";
import { verifiedFlow } from "@/app/lib/auth/flows";
import SetupAccountForm from "./SetupAccountForm";
import { Suspense } from "react";

async function VerifiedSetup() {
  if (!await verifiedFlow("activation")) redirect("/login");
  return <SetupAccountForm />;
}

export default function SetupAccountPage() {
  return <Suspense fallback={<p className="text-sm text-gray-600">Checking your sign-in…</p>}><VerifiedSetup /></Suspense>;
}
