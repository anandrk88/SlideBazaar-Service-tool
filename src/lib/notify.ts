import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import path from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import { prisma } from "./db";
import { appUrl } from "./stripe";
import { localRoot } from "./storage";

export interface NotifyPayload {
  type: string;
  title: string;
  body: string;
  /** In-app link, e.g. /dashboard/orders/abc */
  href?: string;
}

let transporter: Transporter | null | undefined;

function smtp() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

function emailHtml(name: string, p: NotifyPayload) {
  const link = p.href ? `${appUrl()}${p.href}` : appUrl();
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#16244f">
    <div style="padding:20px 0;border-bottom:1px solid #e5e7eb"><strong style="font-size:18px">SlideBazaar</strong> <span style="color:#6b7280;font-size:12px;letter-spacing:.15em;text-transform:uppercase">Design Services</span></div>
    <h2 style="font-size:20px;margin:24px 0 8px">${escape(p.title)}</h2>
    <p style="font-size:15px;line-height:1.5;color:#374151">Hi ${escape(name.split(" ")[0])},<br/>${escape(p.body)}</p>
    <p style="margin:28px 0"><a href="${link}" style="background:#ff6a3d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Open in SlideBazaar</a></p>
    <p style="font-size:12px;color:#9ca3af">You receive this because you have an account at SlideBazaar Design Services.</p>
  </div>`;
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Send one email. Returns true if delivered via SMTP; otherwise logs to the dev outbox and returns false. */
async function sendEmail(to: { email: string; name: string }, p: NotifyPayload) {
  const t = smtp();
  const subject = `[SlideBazaar] ${p.title}`;
  if (t) {
    await t.sendMail({ from: process.env.SMTP_FROM || "SlideBazaar <no-reply@slidebazaar.com>", to: to.email, subject, html: emailHtml(to.name, p), text: `${p.title}\n\n${p.body}\n\n${appUrl()}${p.href ?? ""}` });
    return true;
  }
  try {
    await mkdir(localRoot(), { recursive: true });
    await appendFile(path.join(localRoot(), "outbox.log"), `${new Date().toISOString()}  TO: ${to.email}  SUBJECT: ${subject}\n  ${p.body}\n  ${appUrl()}${p.href ?? ""}\n\n`);
  } catch {}
  console.log(`[email -> ${to.email}] ${subject}`);
  return false;
}

/**
 * Email somebody without creating an in-app notification.
 *
 * Password resets and address verification go here: the recipient cannot
 * necessarily log in, so an in-app notification would never be seen, and a
 * reset link sitting in the notifications list would be a second place to
 * steal it from.
 */
export async function sendTransactionalEmail(to: { email: string; name: string }, p: NotifyPayload) {
  return sendEmail(to, p);
}

/** Create in-app notifications for the given users and email each of them. */
export async function notifyUsers(userIds: (string | null | undefined)[], p: NotifyPayload) {
  const ids = Array.from(new Set(userIds.filter((x): x is string => Boolean(x))));
  if (ids.length === 0) return;
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true } });
  await Promise.all(
    users.map(async (u) => {
      const n = await prisma.notification.create({ data: { userId: u.id, type: p.type, title: p.title, body: p.body, href: p.href ?? null } });
      try {
        const sent = await sendEmail(u, p);
        if (sent) await prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      } catch (err) {
        console.error("email failed", err);
      }
    }),
  );
}

/** Notify everyone with one of the given roles (e.g. all QC managers). */
export async function notifyRoles(roles: string[], p: NotifyPayload) {
  const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  await notifyUsers(users.map((u) => u.id), p);
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id?: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
}
