import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, text } from "./ui";

export interface TeamInviteProps {
  inviterName: string;
  inviterEmail: string;
  inviteUrl: string;
  /** e.g. "October 25, 2026". */
  expiresOn: string;
}

type Props = TeamInviteProps & { logoSrc?: string };

export const teamInviteSubject = (props: TeamInviteProps): string => `${props.inviterName} invited you to the ZODE team`;

/** Sent to anyone a super admin invites to the ZODE team, with or without a ZODE account. */
export default function TeamInvite(props: Props): ReactElement {
  const { inviterName, inviterEmail, inviteUrl, expiresOn } = props;

  const rows: EmailRow[] = [
    { label: "Role", value: "Team" },
    { label: "Invited by", value: inviterEmail },
  ];

  return (
    <Layout preview={`${inviterName} invited you to join the ZODE team.`} logoSrc={props.logoSrc}>
      <Legend>Team invite</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        You&apos;ve been invited to the ZODE team.
      </Heading>
      <Text style={text.paragraph}>
        {inviterName} added you to the ZODE team in the portal. Open the link below and sign in with this email
        address. If you don&apos;t have a ZODE account yet, you can create one from the same page.
      </Text>

      <Rows rows={rows} />

      <Button
        href={inviteUrl}
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
        Join the team
      </Button>

      <Rule />

      <Text style={{ ...text.fineprint, margin: "0 0 8px" }}>This link is personal to you and works until {expiresOn}.</Text>
      <Text style={{ ...text.fineprint, margin: 0 }}>
        Weren&apos;t expecting this? You can ignore it, or write to{" "}
        <Link href="mailto:hello@zode.org" style={{ color: color.muted, textDecoration: "underline" }}>
          hello@zode.org
        </Link>
        .
      </Text>
    </Layout>
  );
}
