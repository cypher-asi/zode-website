import { render } from "@react-email/render";
import { createElement } from "react";
import OrderConfirmation from "@/emails/OrderConfirmation";
import OrderNotification from "@/emails/OrderNotification";
import { PREVIEW_BUY, PREVIEW_LOGO, PREVIEW_RENT } from "@/emails/previewOrders";

const TEMPLATES = { confirmation: OrderConfirmation, notification: OrderNotification };

/**
 * Development only: an order email rendered with a sample order, e.g.
 * /dev/emails/confirmation, /dev/emails/notification?mode=rent, or add
 * `&text` for the plain-text part.
 */
export async function GET(request: Request, { params }: { params: Promise<{ template: string }> }): Promise<Response> {
  const { template } = await params;
  if (process.env.NODE_ENV !== "development" || !Object.hasOwn(TEMPLATES, template)) {
    return new Response("Not found", { status: 404 });
  }

  const search = new URL(request.url).searchParams;
  const order = search.get("mode") === "rent" ? PREVIEW_RENT : PREVIEW_BUY;
  const email = createElement(TEMPLATES[template as keyof typeof TEMPLATES], { ...order, logoSrc: PREVIEW_LOGO });
  const plainText = search.has("text");
  const body = plainText ? await render(email, { plainText: true }) : await render(email);

  return new Response(body, {
    headers: { "content-type": `text/${plainText ? "plain" : "html"}; charset=utf-8` },
  });
}
