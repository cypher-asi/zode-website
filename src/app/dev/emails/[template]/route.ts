import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";
import DataRoomInvite from "@/emails/DataRoomInvite";
import EngineerRequestNotification from "@/emails/EngineerRequestNotification";
import OrderConfirmation from "@/emails/OrderConfirmation";
import OrderNotification from "@/emails/OrderNotification";
import {
  PREVIEW_ACCOUNT,
  PREVIEW_BUY,
  PREVIEW_DATA_ROOM_INVITE,
  PREVIEW_ENGINEER,
  PREVIEW_LOGO,
  PREVIEW_RENT,
} from "@/emails/previewOrders";
import RegistrationNotification from "@/emails/RegistrationNotification";
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
};

/**
 * Development only: an email rendered with sample data, e.g.
 * /dev/emails/confirmation, /dev/emails/notification?mode=rent,
 * /dev/emails/engineer, /dev/emails/welcome, /dev/emails/registration,
 * /dev/emails/data-room-invite,
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
