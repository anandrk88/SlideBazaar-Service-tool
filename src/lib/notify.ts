import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { dispatch, modeFor, pabblyConfigured, sendPabbly } from "./pabbly";
import { appNotificationEvent } from "./pabbly-events";
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
  const port = Number(process.env.SMTP_PORT || 587);

  // Which ports expect TLS from the first byte, rather than STARTTLS after a
  // plaintext greeting. Getting this wrong is not a polite failure: the server
  // waits for a TLS handshake, we wait for a greeting, and nodemailer
  // eventually reports "Greeting never received" with nothing to say which end
  // was wrong. 2465 is the trap, because it is a TLS-wrapper port that an
  // equality check against 465 alone misses.
  const TLS_WRAPPER_PORTS = [465, 2465];
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : TLS_WRAPPER_PORTS.includes(port);

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    // Fail fast and visibly. The default waits long enough that a serverless
    // function can be torn down first, which turns a misconfiguration into
    // "the email just never arrived" with no error anywhere.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
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
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true, role: true } });
  const created = await Promise.all(
    users.map(async (u) => {
      const n = await prisma.notification.create({ data: { userId: u.id, type: p.type, title: p.title, body: p.body, href: p.href ?? null } });
      try {
        const sent = await sendEmail(u, p);
        if (sent) await prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      } catch (err) {
        console.error("email failed", err);
      }
      return n.id;
    }),
  );

  // One webhook per payload, deliberately outside the loop: notifyRoles(["MANAGER",
  // "ADMIN"]) with three admins would otherwise fire three identical messages.
  // notifyRoles delegates straight here, so this single site covers every
  // existing notification in the app and every future one.
  //
  // Only the title and the length of the body go out. Several of these bodies
  // are a verbatim slice of something a customer typed.
  if (pabblyConfigured() && users.length) {
    const mode = await modeFor(`app.${p.type}`);
    const audiences = Array.from(new Set(users.map((u) => (u.role === "CUSTOMER" ? "customer" : u.role === "DESIGNER" ? "designer" : "staff"))));
    const wanted = mode === "all" || (mode === "staff" && audiences.includes("staff"));
    if (wanted) {
      await dispatch(async () => {
        await sendPabbly(
          appNotificationEvent({
            type: p.type,
            title: p.title,
            href: p.href ?? null,
            bodyChars: p.body.length,
            recipients: users.length,
            audiences,
            at: new Date(),
            key: created[0] ?? `${p.type}:${Date.now()}`,
          }),
        );
      });
    }
  }
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
