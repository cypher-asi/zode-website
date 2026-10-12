import { Button, Heading, Text } from "@react-email/components";
import type { ReactElement } from "react";
import type { AccountEmailProps } from "./accountEmailProps";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, color, text } from "./ui";

type Props = AccountEmailProps & { logoSrc?: string };

export const registrationSubject = ({ name, email }: AccountEmailProps): string => `New account: ${name} (${email})`;

/** Sent to the ZODE team for every new account; replies go to the new user. */
export default function RegistrationNotification(props: Props): ReactElement {
  const { userId, name, email, zid, inviteCode, registeredAt } = props;

  const who: EmailRow[] = [
    { label: "Name", value: name },
    { label: "Email", value: email },
    { label: "ZID", value: zid || "None yet" },
    { label: "Invite code", value: inviteCode || "Default" },
    { label: "User ID", value: userId },
  ];

  return (
    <Layout preview={`${name} (${email}) created a ZODE account`} logoSrc={props.logoSrc}>
      <Legend>New account</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 4px", fontSize: "22px", lineHeight: "28px", fontWeight: 600, color: color.ink }}
      >
        {name}
      </Heading>
      <Text style={{ ...text.fineprint, margin: "0 0 24px" }}>{registeredAt}</Text>

      <Rows rows={who} />

      <Button
        href={`mailto:${email}?subject=${encodeURIComponent("Welcome to ZODE")}`}
        style={{
          margin: "16px 0 0",
          padding: "11px 18px",
          backgroundColor: color.ink,
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: 500,
          color: color.onInk,
        }}
      >
        Email {name.split(" ")[0]}
      </Button>
    </Layout>
  );
}
