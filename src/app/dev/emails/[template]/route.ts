import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";
import DataRoomInvite from "@/emails/DataRoomInvite";
import EngineerRequestNotification from "@/emails/EngineerRequestNotification";
import MailingListConfirm from "@/emails/MailingListConfirm";
import MndaExecuted from "@/emails/MndaExecuted";
import OrderConfirmation from "@/emails/OrderConfirmation";
import OrderNotification from "@/emails/OrderNotification";
import {
  PREVIEW_ACCOUNT,
  PREVIEW_BUY,
  PREVIEW_DATA_ROOM_INVITE,
  PREVIEW_ENGINEER,
  PREVIEW_LOGO,
  PREVIEW_MNDA,
  PREVIEW_RENT,
  PREVIEW_TEAM_INVITE,
} from "@/emails/previewOrders";
import RegistrationNotification from "@/emails/RegistrationNotification";
import TeamInvite from "@/emails/TeamInvite";
import Welcome from "@/emails/Welcome";

const TEMPLATES: Record<string, (search: URLSearchParams) => ReactElement> = {
  confirmation: (search) =>
    createElement(OrderConfirmation, { ...(search.get("mode") === "rent" ? PREVIEW_RENT : PREVIEW_BUY), logoSrc: PREVIEW_LOGO }),
  notification: (search) =>
    createElement(OrderNotification, { ...(search.get("mode") === "rent" ? PREVIEW_RENT : PREVIEW_BUY), logoSrc: PREVIEW_LOGO }),
  engineer: () => createElement(EngineerRequestNotification, { ...PREVIEW_ENGINEER, logoSrc: PREVIEW_LOGO }),
  welcome: () => createElement(Welcome, { ...PREVIEW_ACCOUNT, logoSrc: PREVIEW_LOGO }),
  registration: () => createElement(RegistrationNotification, { ...PREVIEW_ACCOUNT, logoSrc: PREVIEW_LOGO }),
  "data-room-invite": () => createElement(DataRoomInvite, { ...PREVIEW_DATA_ROOM_INVITE, logoSrc: PREVIEW_LOGO }),
  "team-invite": (search) =>
    createElement(TeamInvite, {
      ...PREVIEW_TEAM_INVITE,
      role: search.get("role") === "member" ? "member" : "team",
      logoSrc: PREVIEW_LOGO,
    }),
  "mailing-list-confirm": (search) =>
    createElement(MailingListConfirm, {
      name: "Ada Lovelace",
      list: search.get("list") === "changelog" ? "changelog" : "news",
      confirmUrl: "http://localhost:3000/mailing-list/confirm/preview-token",
      logoSrc: PREVIEW_LOGO,
    }),
  mnda: (search) =>
    createElement(MndaExecuted, {
      ...PREVIEW_MNDA,
      audience: search.get("audience") === "team" ? "team" : "signer",
      logoSrc: PREVIEW_LOGO,
    }),
};

/**
 * Development only: an email rendered with sample data, e.g.
 * /dev/emails/confirmation, /dev/emails/notification?mode=rent,
 * /dev/emails/engineer, /dev/emails/welcome, /dev/emails/registration,
 * /dev/emails/data-room-invite, /dev/emails/team-invite?role=member, /dev/emails/mailing-list-confirm?list=changelog, /dev/emails/mnda?audience=team,
 * or add `&text` for the plain-text part.
 */
export async function GET(request: Request, { params }: { params: Promise<{ template: string }> }): Promise<Response> {
  const { template } = await params;
  if (process.env.NODE_ENV !== "development" || !Object.hasOwn(TEMPLATES, template)) {
    return new Response("Not found", { status: 404 });
  }

  const search = new URL(request.url).searchParams;
  const email = TEMPLATES[template](search);
  const plainText = search.has("text");
  const body = plainText ? await render(email, { plainText: true }) : await render(email);

  return new Response(body, {
    headers: { "content-type": `text/${plainText ? "plain" : "html"}; charset=utf-8` },
  });
}
