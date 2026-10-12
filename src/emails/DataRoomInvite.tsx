import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, text } from "./ui";

export interface DataRoomInviteProps {
  roomName: string;
  inviterName: string;
  inviterEmail: string;
  /** "Admin" or "Viewer". */
  roleLabel: string;
  inviteUrl: string;
  /** e.g. "October 25, 2026". */
  expiresOn: string;
  /** The invitee signs ZODE's mutual NDA before they can open the room. */
  requiresMnda: boolean;
}

type Props = DataRoomInviteProps & { logoSrc?: string };

export const dataRoomInviteSubject = (props: DataRoomInviteProps): string =>
  `${props.inviterName} shared the "${props.roomName}" data room with you`;

/** Sent to anyone invited to a data room, with or without a ZODE account. */
export default function DataRoomInvite(props: Props): ReactElement {
  const { roomName, inviterName, inviterEmail, roleLabel, inviteUrl, expiresOn, requiresMnda } = props;

  const rows: EmailRow[] = [
    { label: "Data room", value: roomName },
    { label: "Access", value: roleLabel },
    { label: "Invited by", value: inviterEmail },
    ...(requiresMnda ? [{ label: "Before you enter", value: "Sign the mutual NDA" }] : []),
  ];

  return (
    <Layout preview={`${inviterName} invited you to the ${roomName} data room on ZODE.`} logoSrc={props.logoSrc}>
      <Legend>Data room invite</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        You&apos;ve been invited to {roomName}.
      </Heading>
      <Text style={text.paragraph}>
        {inviterName} shared a private data room with you on ZODE. Open the link below and sign in with this email
        address. If you don&apos;t have a ZODE account yet, you can create one from the same page.
        {requiresMnda
          ? " Before the room opens, you'll sign ZODE's mutual nondisclosure agreement on that page; it takes a minute, and you get a signed copy by email."
          : null}
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
        Open data room
      </Button>

      <Rule />

      <Text style={{ ...text.fineprint, margin: "0 0 8px" }}>
        This link is personal to you and works until {expiresOn}. Views and downloads in the data room are recorded.
      </Text>
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
