import { Heading, Text } from "@react-email/components";
import type { ReactElement } from "react";
import { Layout, Legend, Rule, color, font, text } from "./ui";

export interface LoginCodeProps {
  code: string;
  /** Minutes until it expires. */
  minutes: number;
}

type Props = LoginCodeProps & { logoSrc?: string };

/** The code leads, so it reads in the inbox and the notification without opening the email. */
export const loginCodeSubject = (code: string): string => `${code} is your ZODE login code`;

/** Sent when someone asks to log in with an emailed code instead of their password. */
export default function LoginCode(props: Props): ReactElement {
  return (
    <Layout preview={`Your ZODE login code is ${props.code}.`} logoSrc={props.logoSrc}>
      <Legend>Log in</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        Your login code
      </Heading>
      <Text style={text.paragraph}>Enter this code on the ZODE login page to sign in to your ZOS account.</Text>

      <Text
        style={{
          margin: "20px 0 0",
          padding: "16px 20px",
          border: `1px solid ${color.ruleStrong}`,
          borderRadius: "6px",
          fontFamily: font.mono,
          fontSize: "28px",
          lineHeight: "34px",
          fontWeight: 600,
          letterSpacing: "0.3em",
          textAlign: "center",
          color: color.ink,
        }}
      >
        {props.code}
      </Text>

      <Text style={{ ...text.fineprint, margin: "16px 0 0" }}>
        It works once, for {props.minutes} minutes. Asking for another code replaces this one.
      </Text>

      <Rule />

      <Text style={{ ...text.fineprint, margin: 0 }}>
        Didn&apos;t try to log in? Ignore this email; no one can sign in without the code.
      </Text>
    </Layout>
  );
}
