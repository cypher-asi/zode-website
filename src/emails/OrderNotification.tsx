import { Button, Heading, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow, OrderEmailProps } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, font, text } from "./ui";

type Props = OrderEmailProps & { logoSrc?: string };

export const notificationSubject = ({ mode, reference, contact }: OrderEmailProps): string =>
  `New ${mode === "buy" ? "buy order" : "rent request"} ${reference} from ${contact.company || contact.name}`;

/** Sent to the ZODE team for every stored order; replies go to the customer. */
export default function OrderNotification(props: Props): ReactElement {
  const { mode, reference, placedAt, contact, headline, secondary, choices, cluster, breakdown } = props;

  const who: EmailRow[] = [
    { label: "Name", value: contact.name },
    { label: "Email", value: contact.email },
    { label: "Company", value: contact.company || "Not given" },
  ];
  const figures: EmailRow[] = [
    { label: headline.caption, detail: headline.terms, value: headline.value, total: true },
    ...(secondary ? [{ label: secondary.caption, value: secondary.value }] : []),
  ];

  return (
    <Layout preview={`${contact.name} · ${headline.value} · ${reference}`} logoSrc={props.logoSrc}>
      <Legend>{mode === "buy" ? "New buy order" : "New rent request"}</Legend>
      <Heading
        as="h1"
        style={{
          margin: "0 0 4px",
          fontFamily: font.mono,
          fontSize: "24px",
          lineHeight: "30px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: color.ink,
        }}
      >
        {reference}
      </Heading>
      <Text style={{ ...text.fineprint, margin: "0 0 24px" }}>{placedAt}</Text>

      <Legend>Customer</Legend>
      <Rows rows={who} />
      {contact.notes ? (
        <Text
          style={{
            ...text.paragraph,
            margin: "12px 0 0",
            padding: "12px 16px",
            backgroundColor: color.page,
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
          }}
        >
          {contact.notes}
        </Text>
      ) : null}
      <Button
        href={`mailto:${contact.email}?subject=${encodeURIComponent(`Re: your ZODE ${mode === "buy" ? "order" : "cluster request"} ${reference}`)}`}
        style={{
          margin: "16px 0 0",
          padding: "11px 18px",
          backgroundColor: color.ink,
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: 500,
          color: "#ffffff",
        }}
      >
        Reply to {contact.name.split(" ")[0]}
      </Button>

      <Rule />

      <Legend>Quote</Legend>
      <Rows rows={figures} />

      <Rule />

      <Legend>Configuration</Legend>
      <Rows rows={[...choices, ...cluster]} />

      <Rule />

      <Legend>{breakdown.title}</Legend>
      <Rows rows={[...breakdown.rows, ...breakdown.footer]} />
    </Layout>
  );
}