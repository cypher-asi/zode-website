import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { accountEmailProps } from "@/emails/accountEmailProps";
import EngineerRequestNotification, { engineerRequestSubject } from "@/emails/EngineerRequestNotification";
import { engineerRequestEmailProps } from "@/emails/engineerRequestEmailProps";
import OrderConfirmation, { confirmationSubject } from "@/emails/OrderConfirmation";
import OrderNotification, { notificationSubject } from "@/emails/OrderNotification";
import { orderEmailProps } from "@/emails/orderEmailProps";
import RegistrationNotification, { registrationSubject } from "@/emails/RegistrationNotification";
import { WORDMARK_CID } from "@/emails/ui";
import Welcome, { welcomeSubject } from "@/emails/Welcome";
import { WORDMARK_PNG_BASE64 } from "@/emails/wordmark";
import type { EngineerRequest } from "./engineer-requests";
import { RECIPIENT_EMAIL } from "./leads";
import type { Order } from "./orders";
import type { Account } from "./zos";

let client: Resend | undefined;

/** Resend for RESEND_API_KEY (set by the Vercel integration), or undefined when it isn't configured. */
function resend(): Resend | undefined {
  const key = process.env.RESEND_API_KEY;
  if (!key) return undefined;
  client ??= new Resend(key);
  return client;
}

/**
 * RESEND_EMAIL_DOMAIN is the verified domain the Vercel integration sets. Without
 * it, Resend's shared test sender only delivers to the account owner.
 */
function sender(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const domain = process.env.RESEND_EMAIL_DOMAIN;
  return domain ? `ZODE <orders@${domain}>` : "ZODE <onboarding@resend.dev>";
}

const teamInbox = (): string => process.env.ORDERS_NOTIFY_EMAIL || RECIPIENT_EMAIL;

/** Never honoured on the production deployment, so a stray value can't swallow real customer mail. */
const devRecipient = (): string | undefined =>
  process.env.VERCEL_ENV === "production" ? undefined : process.env.EMAIL_DEV_TO || undefined;

interface Message {
  to: string;
  replyTo: string;
  subject: string;
  email: ReactElement;
  idempotencyKey: string;
}

async function send({ to, replyTo, subject, email, idempotencyKey }: Message): Promise<void> {
  const redirect = devRecipient();
  if (redirect) {
    subject = `[to ${to}] ${subject}`;
    to = redirect;
  }

  const mailer = resend();
  if (!mailer) {
    console.warn(`[email] RESEND_API_KEY is not set; not sending "${subject}" to ${to}.`);
    return;
  }

  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  const { error } = await mailer.emails.send(
    {
      from: sender(),
      to,
      replyTo,
      subject,
      html,
      text,
      attachments: [
        { filename: "zode.png", content: Buffer.from(WORDMARK_PNG_BASE64, "base64"), contentId: WORDMARK_CID },
      ],
    },
    { idempotencyKey },
  );
  if (error) throw new Error(`${error.name}: ${error.message}`);
}

/**
 * Emails the customer their confirmation and the team a copy of the order.
 * Never throws: the order is already stored, so a failed send is only logged.
 */
export async function sendOrderEmails(order: Order, reference: string): Promise<void> {
  const props = orderEmailProps(order, reference);
  const team = teamInbox();

  const results = await Promise.allSettled([
    send({
      to: order.contact.email,
      replyTo: team,
      subject: confirmationSubject(props),
      email: <OrderConfirmation {...props} />,
      idempotencyKey: `order-${reference}-customer`,
    }),
    send({
      to: team,
      replyTo: order.contact.email,
      subject: notificationSubject(props),
      email: <OrderNotification {...props} />,
      idempotencyKey: `order-${reference}-team`,
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const which = i === 0 ? "customer confirmation" : "team notification";
      console.error(`[email] ${which} for order ${reference} failed:`, result.reason);
    }
  });
}

/**
 * Emails the team a Talk to an Engineer request; replies go to the requester.
 * Never throws: the request is already stored, so a failed send is only logged.
 */
export async function sendEngineerRequestEmail(request: EngineerRequest, reference: string): Promise<void> {
  const props = engineerRequestEmailProps(request, reference);
  try {
    await send({
      to: teamInbox(),
      replyTo: request.email,
      subject: engineerRequestSubject(props),
      email: <EngineerRequestNotification {...props} />,
      idempotencyKey: `engineer-${reference}-team`,
    });
  } catch (err) {
    console.error(`[email] team notification for engineer request ${reference} failed:`, err);
  }
}

/**
 * Welcomes a new account holder and tells the team who signed up.
 * Never throws: the account already exists, so a failed send is only logged.
 */
export async function sendRegistrationEmails(account: Account, inviteCode: string): Promise<void> {
  const props = accountEmailProps(account, inviteCode);
  const team = teamInbox();

  const results = await Promise.allSettled([
    send({
      to: account.email,
      replyTo: team,
      subject: welcomeSubject(),
      email: <Welcome {...props} />,
      idempotencyKey: `register-${account.userId}-welcome`,
    }),
    send({
      to: team,
      replyTo: account.email,
      subject: registrationSubject(props),
      email: <RegistrationNotification {...props} />,
      idempotencyKey: `register-${account.userId}-team`,
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const which = i === 0 ? "welcome email" : "team notification";
      console.error(`[email] ${which} for new account ${account.userId} failed:`, result.reason);
    }
  });
}
