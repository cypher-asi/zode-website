import { Column, Heading, Link, Row, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { OrderEmailProps } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, font, greetingName, text } from "./ui";

type Props = OrderEmailProps & { logoSrc?: string };

export const confirmationSubject = ({ mode, reference }: Pick<OrderEmailProps, "mode" | "reference">): string =>
  mode === "buy" ? `Your ZODE order ${reference}` : `Your ZODE cluster request ${reference}`;

/** Sent to the customer once their order or rental request is stored. */
export default function OrderConfirmation(props: Props): ReactElement {
  const { mode, reference, placedAt, contact, headline, secondary, choices, cluster, breakdown, fineprint } = props;
  const firstName = greetingName(contact.name);
  const placed = mode === "buy" ? "Order placed" : "Request received";
  const thing = mode === "buy" ? "order" : "cluster request";

  return (
    <Layout preview={`${placed}: ${reference}. We'll confirm configuration and pricing before anything is final.`} logoSrc={props.logoSrc}>
      <Legend>{placed}</Legend>
      <Heading
        as="h1"
        style={{
          margin: "0 0 4px",
          fontFamily: font.mono,
          fontSize: "28px",
          lineHeight: "34px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: color.ink,
        }}
      >
        {reference}
      </Heading>
      <Text style={{ ...text.fineprint, margin: "0 0 24px" }}>{placedAt}</Text>

      <Text style={text.paragraph}>Thanks{firstName ? `, ${firstName}` : ""}.</Text>
      <Text style={text.paragraph}>
        We have your {thing}. A member of the ZODE team will be in touch to confirm the configuration and final pricing
        with you. Nothing is charged and nothing is binding until then. Quote <strong>{reference}</strong> in any reply.
      </Text>

      <Section
        style={{
          margin: "8px 0 0",
          padding: "20px 24px",
          backgroundColor: color.ink,
          borderRadius: "6px",
        }}
      >
        <Row>
          <Column style={{ verticalAlign: "bottom" }}>
            <Text style={{ ...text.legend, margin: "0 0 6px", color: color.accent }}>{headline.caption}</Text>
            <Text style={{ margin: 0, fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: "#ffffff" }}>
              {headline.value}
            </Text>
            {headline.terms ? (
              <Text style={{ margin: "6px 0 0", fontSize: "12px", lineHeight: "18px", color: "#b4b4b9" }}>
                {headline.terms}
              </Text>
            ) : null}
          </Column>
          {secondary ? (
            <Column align="right" style={{ verticalAlign: "bottom" }}>
              <Text style={{ ...text.legend, margin: "0 0 6px", color: "#b4b4b9" }}>{secondary.caption}</Text>
              <Text style={{ margin: 0, fontSize: "18px", lineHeight: "24px", fontWeight: 500, color: "#ffffff" }}>
                {secondary.value}
              </Text>
            </Column>
          ) : null}
        </Row>
      </Section>

      <Rule />

      <Legend>Your configuration</Legend>
      <Rows rows={choices} />

      <Section style={{ margin: "16px 0 0" }}>
        <Row>
          {cluster.map((stat) => (
            <Column key={stat.label} style={{ width: `${100 / cluster.length}%`, verticalAlign: "top", paddingRight: "8px" }}>
              <Text style={{ margin: 0, fontSize: "15px", lineHeight: "20px", fontWeight: 600, color: color.ink }}>
                {stat.value}
              </Text>
              <Text style={{ margin: "2px 0 0", fontSize: "11px", lineHeight: "15px", color: color.muted }}>
                {stat.label}
              </Text>
            </Column>
          ))}
        </Row>
      </Section>

      <Rule />

      <Legend>{breakdown.title}</Legend>
      <Rows rows={[...breakdown.rows, ...breakdown.footer]} />
      <Text style={{ ...text.fineprint, margin: "10px 0 0" }}>{fineprint}</Text>

      <Rule />

      <Legend>What happens next</Legend>
      <Text style={text.paragraph}>
        1. We review your configuration and check capacity at your chosen location.
        <br />
        2. We send you a confirmed configuration and final pricing.
        <br />
        3. Nothing proceeds until you agree to it in writing.
      </Text>
      <Text style={{ ...text.paragraph, margin: 0 }}>
        Questions in the meantime? Reply to this email or write to{" "}
        <Link href="mailto:hello@zode.org" style={{ color: color.ink, textDecoration: "underline" }}>
          hello@zode.org
        </Link>
        .
      </Text>
    </Layout>
  );
}