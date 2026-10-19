import "server-only";
import type { FlowPurpose } from "./flows";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)); }

export function applicationUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error("Application URL is missing.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Application URL must use HTTPS.");
  return url.origin;
}

function templateId(value: string | undefined) { return value && /^\d+$/.test(value) ? Number(value) : undefined; }

async function deliver(email: string, content: Record<string, unknown>) {
  const key = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "EMS";
  if (!key || !senderEmail) throw new Error("Transactional email configuration is missing.");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { email: senderEmail, name: senderName }, to: [{ email }], ...content }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email delivery provider rejected the request.");
}

export async function sendActivationEmail(email: string, username: string, password: string, loginUrl: string, validHours: number) {
  const subject = "Your EMS temporary sign-in credentials";
  const template = templateId(process.env.BREVO_ACTIVATION_TEMPLATE_ID);
  const [safeUsername, safePassword, safeLink] = [username, password, loginUrl].map(escapeHtml);
  const cell = "padding:8px 12px;border:1px solid #e4e1f5";
  const content = template ? { templateId: template, params: { USERNAME: username, TEMPORARY_PASSWORD: password, LOGIN_URL: loginUrl, ACTION_URL: loginUrl, VALID_HOURS: validHours, SUBJECT: subject } } : {
    subject,
    htmlContent: `<html><body style="font-family:Arial,sans-serif;color:#292334;line-height:1.6"><h2>Activate your EMS account</h2><p>Use these temporary credentials to sign in. You will be asked to choose your own username and password right after signing in.</p><table style="border-collapse:collapse;margin:16px 0"><tr><td style="${cell};font-weight:bold">Temporary username</td><td style="${cell};font-family:Consolas,monospace">${safeUsername}</td></tr><tr><td style="${cell};font-weight:bold">Temporary password</td><td style="${cell};font-family:Consolas,monospace">${safePassword}</td></tr></table><p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#6554f4;color:white;text-decoration:none;border-radius:5px">Sign in to EMS</a></p><p>These credentials expire in ${validHours} hours. Requesting another activation email replaces them. Do not share them with anyone.</p><p>If you did not request this email, ignore it and contact your manager.</p><p>EMS Employee Management System</p></body></html>`,
    textContent: `Activate your EMS account\n\nTemporary username: ${username}\nTemporary password: ${password}\n\nSign in: ${loginUrl}\n\nYou will be asked to choose your own username and password after signing in. These credentials expire in ${validHours} hours. If you did not request this email, ignore it.`,
  };
  await deliver(email, content);
}

export async function sendAuthEmail(email: string, link: string, purpose: FlowPurpose) {
  const subject = "Reset your EMS password";
  const template = templateId(purpose === "recovery" ? process.env.BREVO_PASSWORD_RESET_TEMPLATE_ID : undefined);
  const safeLink = escapeHtml(link);
  const content = template ? { templateId: template, params: { ACTION_URL: link, RESET_URL: link, SUBJECT: subject } } : {
    subject,
    htmlContent: `<html><body style="font-family:Arial,sans-serif;color:#292334;line-height:1.6"><h2>${subject}</h2><p>Use the secure link below to choose a new password.</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#6554f4;color:white;text-decoration:none;border-radius:5px">Reset password</a></p><p>This link expires according to your organization’s Supabase email policy and can be verified only once. After verification, complete the form within 15 minutes.</p><p>If you did not request this email, ignore it. Your account remains unchanged.</p><p>EMS Employee Management System</p></body></html>`,
    textContent: `${subject}\n\nOpen this secure, single-use link:\n${link}\n\nIf you did not request this email, ignore it.`,
  };
  await deliver(email, content);
}
