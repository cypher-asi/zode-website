import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactElement } from "react";
import { mailingList, type MailingList } from "@/features/mailing-list/types";
import { Layout, Legend, Rule, color, greetingName, text } from "./ui";

export interface MailingListConfirmProps {
  name: string | null;
  list: MailingList;
  confirmUrl: string;
}

type Props = MailingListConfirmProps & { logoSrc?: string };

export const mailingListConfirmSubject = (list: MailingList): string => `Confirm your ZODE ${list} subscription`;

/** Sent when someone signs up for a mailing list; nothing is sent to them until they confirm. */
export default function MailingListConfirm(props: Props): ReactElement {
  const firstName = props.name ? greetingName(props.name) : "";
  const { topic } = mailingList(props.list);

  return (
    <Layout preview={`One click to start getting ${topic}.`} logoSrc={props.logoSrc}>
      <Legend>Mailing list</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        Confirm your subscription{firstName ? `, ${firstName}` : ""}.
      </Heading>
      <Text style={text.paragraph}>
        Someone, hopefully you, asked to get {topic} at this address. Confirm and we&apos;ll email you when we
        publish. You can unsubscribe from any email.
      </Text>

      <Button
        href={props.confirmUrl}
        style={{
          margin: "20px 0 0",
          padding: "12px 20px",
          backgroundColor: color.ink,
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 500,
          color: color.onInk,
        }}
      >
        Confirm subscription
      </Button>

      <Text style={{ ...text.fineprint, margin: "16px 0 0" }}>
        The link works for 7 days. Or paste this into your browser:{" "}
        <Link href={props.confirmUrl} style={{ color: color.muted, textDecoration: "underline" }}>
          {props.confirmUrl}
        </Link>
      </Text>

      <Rule />

      <Text style={{ ...text.fineprint, margin: 0 }}>
        Didn&apos;t sign up? Ignore this email and you won&apos;t hear from us.
      </Text>
    </Layout>
  );
}
