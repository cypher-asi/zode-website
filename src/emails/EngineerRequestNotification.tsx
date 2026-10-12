import { Button, Heading, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, font, text } from "./ui";

export interface EngineerRequestEmailProps {
  reference: string;
  placedAt: string;
  interests: string;
  deploymentSize: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  logoSrc?: string;
}

export const engineerRequestSubject = ({ reference, name, company }: EngineerRequestEmailProps): string =>
  `Talk to an Engineer ${reference}: ${name}${company ? ` (${company})` : ""}`;

/** Sent to the ZODE team for every Talk to an Engineer request; replies go to the requester. */
export default function EngineerRequestNotification(props: EngineerRequestEmailProps): ReactElement {
  const { reference, placedAt, interests, deploymentSize, name, title, company, phone, email } = props;
  const firstName = name.split(" ")[0];

  const need: EmailRow[] = [
    { label: "Interested in", value: interests },
    { label: "Deployment size", value: `${deploymentSize} nodes` },
  ];
  const who: EmailRow[] = [
    { label: "Name", value: name },
    { label: "Title", value: title || "Not given" },
    { label: "Company website", value: company || "Not given" },
    { label: "Phone", value: phone },
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
    <Layout preview={`${name} wants to talk · ${interests} · ${deploymentSize} nodes`} logoSrc={props.logoSrc}>
      <Legend>Talk to an Engineer</Legend>
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

      <Legend>What they need</Legend>
      <Rows rows={need} />

      <Rule />

      <Legend>Contact</Legend>
      <Rows rows={who} />
      <Text style={{ ...text.paragraph, margin: "16px 0 0" }}>
        They were told we would email or text them to schedule a meeting.
      </Text>
      <Button
        href={`mailto:${email}?subject=${encodeURIComponent(`Scheduling a call with a ZODE engineer (${reference})`)}`}
        style={{ ...button, backgroundColor: color.ink, color: color.onInk }}
      >
        Email {firstName}
      </Button>
      <Button
        href={`sms:${phone.replace(/[^\d+]/g, "")}`}
        style={{ ...button, border: `1px solid ${color.ruleStrong}`, color: color.ink }}
      >
        Text {firstName}
      </Button>
    </Layout>
  );
}
