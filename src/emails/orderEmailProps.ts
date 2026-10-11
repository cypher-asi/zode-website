import { buyPriceView, quote, usd, type PriceView } from "@/features/configurator/buyConfig";
import { rentPriceView, rentQuote } from "@/features/configurator/rentConfig";
import type { Order, OrderContact } from "@/features/configurator/orders";

export interface EmailStat {
  label: string;
  value: string;
}

export interface EmailRow {
  label: string;
  detail?: string;
  value: string;
  total?: boolean;
}

/** Everything an order email shows, as plain strings, so templates stay free of pricing logic. */
export interface OrderEmailProps {
  mode: Order["mode"];
  reference: string;
  placedAt: string;
  contact: OrderContact;
  headline: { caption: string; value: string; terms?: string };
  secondary?: { caption: string; value: string };
  choices: EmailStat[];
  cluster: EmailStat[];
  breakdown: { title: string; rows: EmailRow[]; footer: EmailRow[] };
  fineprint: string;
}

const PLACED_AT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * The order priced from its configuration with the same views the
 * configurator's price panel uses, so the email matches what was on screen.
 */
export function orderEmailProps(order: Order, reference: string, placedAt = new Date()): OrderEmailProps {
  const view: PriceView =
    order.mode === "buy"
      ? buyPriceView(order.config, quote(order.config))
      : rentPriceView(order.config, rentQuote(order.config));
  const { headline, secondary, breakdown, summary } = view;

  return {
    mode: order.mode,
    reference,
    placedAt: `${PLACED_AT.format(placedAt)} UTC`,
    contact: order.contact,
    headline: {
      caption: headline.caption,
      value: `${headline.format(headline.value)}${headline.unit}`,
      terms: headline.terms,
    },
    secondary: secondary ? { caption: secondary.caption, value: `${secondary.value}${secondary.unit}` } : undefined,
    choices: summary.choices,
    cluster: summary.cluster,
    breakdown: {
      title: breakdown.title,
      rows: breakdown.rows.map((item) => {
        const value = item.amount ? usd(item.amount) : "Included";
        return { label: item.label, detail: item.detail === value ? undefined : item.detail, value };
      }),
      footer: breakdown.footer,
    },
    fineprint: breakdown.fineprint,
  };
}
