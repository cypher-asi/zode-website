import { Button, Heading, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, font, text } from "./ui";

export interface InvestorRequestEmailProps {
  reference: string;
  placedAt: string;
  investorType: string;
  opportunities: string;
  checkSize: string;
  name: string;
  email: string;
  firm: string;
  title: string;
  firmWebsite: string;
  phone: string;
  note: string;
  logoSrc?: string;
}

export const investorRequestSubject = ({ reference, name, firm }: InvestorRequestEmailProps): string =>
  `Investor ${reference}: ${name}${firm ? ` (${firm})` : ""}`;

/** Sent to the ZODE team for every Invest inquiry; replies go to the investor. */
export default function InvestorRequestNotification(props: InvestorRequestEmailProps): ReactElement {
  const { reference, placedAt, investorType, opportunities, checkSize, name, email, firm, title, firmWebsite, phone, note } =
    props;
  const firstName = name.split(" ")[0];

  const investment: EmailRow[] = [
    { label: "Investor type", value: investorType },
    { label: "Interested in", value: opportunities },
    { label: "Typical check", value: checkSize },
  ];
  const who: EmailRow[] = [
    { label: "Name", value: name },
    { label: "Firm", value: firm || "Not given" },
    { label: "Title", value: title || "Not given" },
    { label: "Firm website", value: firmWebsite || "Not given" },
    { label: "Phone", value: phone || "Not given" },
    { label: "Email", value: email },
  ];
  const button = {
    margin: "16px 8px 0 0",
    padding: "11px 18px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
  };

  return (
    <Layout preview={`${name} wants to invest · ${investorType} · ${checkSize}`} logoSrc={props.logoSrc}>
      <Legend>Investor</Legend>
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

      <Legend>Investment</Legend>
      <Rows rows={investment} />

      {note ? (
        <>
          <Rule />
          <Legend>Note</Legend>
          <Text style={{ ...text.paragraph, margin: 0, whiteSpace: "pre-line" }}>{note}</Text>
        </>
      ) : null}

      <Rule />

      <Legend>Contact</Legend>
      <Rows rows={who} />
      <Text style={{ ...text.paragraph, margin: "16px 0 0" }}>They were told the team would follow up by email.</Text>
      <Button
        href={`mailto:${email}?subject=${encodeURIComponent(`Investing in ZODE (${reference})`)}`}
        style={{ ...button, backgroundColor: color.ink, color: color.onInk }}
      >
        Email {firstName}
      </Button>
      {phone ? (
        <Button
          href={`sms:${phone.replace(/[^\d+]/g, "")}`}
          style={{ ...button, border: `1px solid ${color.ruleStrong}`, color: color.ink }}
        >
          Text {firstName}
        </Button>
      ) : null}
    </Layout>
  );
}
