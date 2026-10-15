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

export async function sendAuthEmail(email: string, link: string, purpose: FlowPurpose) {
  const key = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "EMS";
  if (!key || !senderEmail) throw new Error("Transactional email configuration is missing.");
  const activation = purpose === "activation";
  const subject = activation ? "Activate your EMS account" : "Reset your EMS password";
  const templateValue = activation ? process.env.BREVO_ACTIVATION_TEMPLATE_ID : process.env.BREVO_PASSWORD_RESET_TEMPLATE_ID;
  const templateId = templateValue && /^\d+$/.test(templateValue) ? Number(templateValue) : undefined;
  const safeLink = escapeHtml(link);
  const content = templateId ? { templateId, params: { ACTION_URL: link, ACTIVATION_URL: link, RESET_URL: link, SUBJECT: subject } } : {
    subject,
    htmlContent: `<html><body style="font-family:Arial,sans-serif;color:#292334;line-height:1.6"><h2>${subject}</h2><p>${activation ? "Verify your email address to choose your EMS username and password." : "Use the secure link below to choose a new password."}</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#6554f4;color:white;text-decoration:none;border-radius:5px">${activation ? "Activate account" : "Reset password"}</a></p><p>This link expires according to your organization’s Supabase email policy and can be verified only once. After verification, complete the form within 15 minutes.</p><p>If you did not request this email, ignore it. Your account remains unchanged.</p><p>EMS Employee Management System</p></body></html>`,
    textContent: `${subject}\n\nOpen this secure, single-use link:\n${link}\n\nIf you did not request this email, ignore it.`,
  };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { email: senderEmail, name: senderName }, to: [{ email }], ...content }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email delivery provider rejected the request.");
}
