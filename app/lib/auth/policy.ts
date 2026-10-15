export const authorizedAccounts = [
  { employeeId: "MGR-001", email: "margaretsubong92@gmail.com", role: "department_manager" },
  { employeeId: "EMP-4092", email: "danicaacosta544@gmail.com", role: "employee" },
] as const;

export type Role = typeof authorizedAccounts[number]["role"];
export type AuthProfile = {
  id: string;
  employee_id: string;
  email: string;
  username: string | null;
  role: Role;
  account_status: "pending" | "active" | "disabled";
  activated_at: string | null;
};

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function authorizedAccount(email: string) { return authorizedAccounts.find((account) => account.email === normalizeEmail(email)); }
export function validProfile(profile: AuthProfile | null, user: { id: string; email?: string }) {
  const account = authorizedAccount(user.email || "");
  return !!account && !!profile && profile.id === user.id && profile.email === account.email &&
    profile.employee_id === account.employeeId && profile.role === account.role;
}
export function dashboardFor(role: Role) { return role === "department_manager" ? "/manager/dashboard" : "/employee/dashboard"; }
export function strongPassword(password: string) {
  return password.length >= 8 && password.length <= 128 && /[A-Z]/.test(password) &&
    /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
export function validUsername(username: string) { return /^[a-zA-Z0-9._-]{3,40}$/.test(username); }
