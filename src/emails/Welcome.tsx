import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactElement } from "react";
import { SITE_URL } from "../lib/site";
import type { AccountEmailProps } from "./accountEmailProps";
import type { EmailRow } from "./orderEmailProps";
import { Layout, Legend, Rows, Rule, color, text } from "./ui";

type Props = AccountEmailProps & { logoSrc?: string };

export const welcomeSubject = (): string => "Welcome to ZODE";

const NEXT_STEPS = [
  { href: "/buy-compute", label: "Configure a ZODE", detail: "Size a cluster and see the price as you build it." },
  { href: "/buy-compute?mode=rent", label: "Rent compute", detail: "Get an all-in GPU rate for a dedicated cluster." },
  { href: "/talk-to-an-engineer", label: "Talk to an engineer", detail: "Plan a deployment with the team." },
] as const;

/** Sent to someone as soon as they create a ZODE account. */
export default function Welcome(props: Props): ReactElement {
  const { name, email, zid } = props;
  const firstName = name.split(" ")[0];

  const account: EmailRow[] = [{ label: "Email", value: email }, ...(zid ? [{ label: "ZID", value: zid }] : [])];

  return (
    <Layout preview="Your ZODE account is ready. Configure, rent and track compute from your portal." logoSrc={props.logoSrc}>
      <Legend>Account created</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        Welcome to ZODE{firstName ? `, ${firstName}` : ""}.
      </Heading>
      <Text style={text.paragraph}>
        Your account is ready. Sign in at zode.org with this email and the password you chose to configure compute,
        place orders and follow them from your portal.
      </Text>

      <Rows rows={account} />

      <Button
        href={`${SITE_URL}/portal`}
        style={{
          margin: "20px 0 0",
          padding: "12px 20px",
          backgroundColor: color.ink,
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 500,
          color: "#ffffff",
        }}
      >
        Open your portal
      </Button>

      <Rule />

      <Legend>Where to start</Legend>
      {NEXT_STEPS.map((step) => (
        <Text key={step.href} style={{ ...text.paragraph, margin: "0 0 12px" }}>
          <Link href={`${SITE_URL}${step.href}`} style={{ color: color.ink, fontWeight: 600, textDecoration: "underline" }}>
            {step.label}
          </Link>
          <br />
          <span style={{ color: color.muted }}>{step.detail}</span>
        </Text>
      ))}

      <Rule />

      <Text style={{ ...text.fineprint, margin: 0 }}>
        Didn&apos;t create this account? Reply to this email or write to{" "}
        <Link href="mailto:hello@zode.org" style={{ color: color.muted, textDecoration: "underline" }}>
          hello@zode.org
        </Link>{" "}
        and we&apos;ll look into it.
      </Text>
    </Layout>
  );
}
