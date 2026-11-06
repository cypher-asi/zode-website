import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, text } from "./ui";

export interface DataRoomLinkProps {
  roomName: string;
  inviterName: string;
  inviterEmail: string;
  linkUrl: string;
}

type Props = DataRoomLinkProps & { logoSrc?: string };

export const dataRoomLinkSubject = (props: DataRoomLinkProps): string =>
  `${props.inviterName} shared the "${props.roomName}" data room with you`;

/** Sent with a recipient's own share link, which opens the room without a ZODE account. */
export default function DataRoomLink(props: Props): ReactElement {
  const { roomName, inviterName, inviterEmail, linkUrl } = props;

  const rows: EmailRow[] = [
    { label: "Data room", value: roomName },
    { label: "Shared by", value: inviterEmail },
  ];

  return (
    <Layout preview={`${inviterName} shared the ${roomName} data room with you on ZODE.`} logoSrc={props.logoSrc}>
      <Legend>Data room shared</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        {inviterName} shared {roomName} with you.
      </Heading>
      <Text style={text.paragraph}>
        Open the link below to browse, preview and download the room&apos;s files. You don&apos;t need a ZODE account.
      </Text>

      <Rows rows={rows} />

      <Button
        href={linkUrl}
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
        This link is personal to you; please don&apos;t forward it. Visits, time spent and downloads in the data room
        are recorded and shared with {inviterName}.
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
