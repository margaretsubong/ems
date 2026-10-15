"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { logout } from "../lib/auth/actions";

export default function LogoutButton({ manager = false }: { manager?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  return <><button className={manager ? "manager-signout" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", border: 0, background: "transparent", color: manager ? "#d93e4c" : "#454252", textAlign: "left", fontSize: manager ? 11 : 13 }} disabled={loading} onClick={async () => { setLoading(true); setError(false); try { await logout(); } catch { setLoading(false); setError(true); } }}><LogOut size={17} />{loading ? "Signing out…" : manager ? "Sign Out" : "Logout"}</button>{error && <p role="alert" style={{ padding: "0 12px", fontSize: 11, color: "#b42338" }}>Sign out failed. Try again.</p>}</>;
}
