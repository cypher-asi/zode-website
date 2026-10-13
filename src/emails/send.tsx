import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import type { Account } from "@/features/account/zos";
import type { Order } from "@/features/configurator/orders";
import type { EngineerRequest } from "@/features/engineer-request/engineerRequests";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { accountEmailProps } from "./accountEmailProps";
import { executedFileName } from "@/features/mnda/agreement";
import type { ExecutedMnda } from "@/features/mnda/mndas";
import DataRoomInvite, { dataRoomInviteSubject, type DataRoomInviteProps } from "./DataRoomInvite";
import EngineerRequestNotification, { engineerRequestSubject } from "./EngineerRequestNotification";
import MailingListConfirm, { mailingListConfirmSubject, type MailingListConfirmProps } from "./MailingListConfirm";
import { engineerRequestEmailProps } from "./engineerRequestEmailProps";
import MndaExecuted, { mndaExecutedSubject, type MndaExecutedProps } from "./MndaExecuted";
import OrderConfirmation, { confirmationSubject } from "./OrderConfirmation";
import OrderNotification, { notificationSubject } from "./OrderNotification";
import { orderEmailProps } from "./orderEmailProps";
import RegistrationNotification, { registrationSubject } from "./RegistrationNotification";
import TeamInvite, { teamInviteSubject, type TeamInviteProps } from "./TeamInvite";
import { WORDMARK_CID } from "./ui";
import Welcome, { welcomeSubject } from "./Welcome";
import { WORDMARK_PNG_BASE64 } from "./wordmark";

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
  attachments?: { filename: string; content: Buffer }[];
}

async function send({ to, replyTo, subject, email, idempotencyKey, attachments = [] }: Message): Promise<void> {
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
        ...attachments,
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

/**
 * Emails a data room invite link; replies go to whoever sent it. `key` is
 * unique per issued token, so a resend isn't swallowed by idempotency.
 * Never throws: the invite already exists and can be resent.
 */
export async function sendDataRoomInvite(to: string, props: DataRoomInviteProps, key: string): Promise<void> {
  try {
    await send({
      to,
      replyTo: props.inviterEmail,
      subject: dataRoomInviteSubject(props),
      email: <DataRoomInvite {...props} />,
      idempotencyKey: `data-room-invite-${key}`,
    });
  } catch (err) {
    console.error(`[email] data room invite to ${to} failed:`, err);
  }
}

/**
 * Emails a ZODE team invite link; replies go to whoever sent it. `key` is
 * unique per issued token, so a resend isn't swallowed by idempotency.
 * Never throws: the invite already exists and can be resent.
 */
export async function sendTeamInvite(to: string, props: TeamInviteProps, key: string): Promise<void> {
  try {
    await send({
      to,
      replyTo: props.inviterEmail,
      subject: teamInviteSubject(props),
      email: <TeamInvite {...props} />,
      idempotencyKey: `team-invite-${key}`,
    });
  } catch (err) {
    console.error(`[email] team invite to ${to} failed:`, err);
  }
}

/**
 * Emails a mailing list confirmation link. `key` is unique per issued token,
 * so asking again sends a fresh link. Never throws: they can sign up again.
 */
export async function sendMailingListConfirmation(
  to: string,
  props: MailingListConfirmProps,
  key: string,
): Promise<void> {
  try {
    await send({
      to,
      replyTo: teamInbox(),
      subject: mailingListConfirmSubject(props.list),
      email: <MailingListConfirm {...props} />,
      idempotencyKey: `mailing-list-confirm-${key}`,
    });
  } catch (err) {
    console.error(`[email] mailing list confirmation to ${to} failed:`, err);
  }
}

const mndaInbox = (): string => process.env.MNDA_NOTIFY_EMAIL || teamInbox();

/**
 * Emails the executed MNDA to the signer and to the team, PDF attached.
 * Never throws: the agreement is already stored, so a failed send is only logged.
 */
export async function sendMndaEmails(mnda: ExecutedMnda, roomName: string | null): Promise<void> {
  const { party } = mnda;
  const team = mndaInbox();
  const base: Omit<MndaExecutedProps, "audience"> = {
    agreementId: mnda.id,
    entityName: party.entityName,
    entityType: party.entityType,
    signerName: party.signerName,
    signerTitle: party.signerTitle,
    signerEmail: party.signerEmail,
    zodeSignerName: mnda.zodeSigner.name,
    zodeSignerTitle: mnda.zodeSigner.title,
    effectiveDate: new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(mnda.signedAt),
    roomName,
  };
  const attachments = [{ filename: executedFileName(party.entityName), content: Buffer.from(mnda.pdf) }];

  const results = await Promise.allSettled([
    send({
      to: party.signerEmail,
      replyTo: team,
      subject: mndaExecutedSubject({ ...base, audience: "signer" }),
      email: <MndaExecuted {...base} audience="signer" />,
      idempotencyKey: `mnda-${mnda.id}-signer`,
      attachments,
    }),
    send({
      to: team,
      replyTo: party.signerEmail,
      subject: mndaExecutedSubject({ ...base, audience: "team" }),
      email: <MndaExecuted {...base} audience="team" />,
      idempotencyKey: `mnda-${mnda.id}-team`,
      attachments,
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const which = i === 0 ? "signer copy" : "team copy";
      console.error(`[email] MNDA ${which} for ${mnda.id} failed:`, result.reason);
    }
  });
}
