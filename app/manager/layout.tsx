import { ManagerShell } from "./portal";
import "../employee/portal.css";
import "./manager.css";
import { requirePortal } from "../lib/auth/session";
import { Suspense } from "react";

async function AuthorizedManager({ children }: { children: React.ReactNode }) {
  await requirePortal("department_manager");
  return <ManagerShell>{children}</ManagerShell>;
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6 text-sm text-gray-600">Verifying session…</p>}><AuthorizedManager>{children}</AuthorizedManager></Suspense>;
}
