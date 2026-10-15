import { EmployeeShell } from "./portal";
import "./portal.css";
import { requirePortal } from "../lib/auth/session";
import { Suspense } from "react";

async function AuthorizedEmployee({ children }: { children: React.ReactNode }) {
  await requirePortal("employee");
  return <EmployeeShell>{children}</EmployeeShell>;
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6 text-sm text-gray-600">Verifying session…</p>}><AuthorizedEmployee>{children}</AuthorizedEmployee></Suspense>;
}
