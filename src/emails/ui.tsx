import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { EmailRow } from "./orderEmailProps";

/** Content id of the inline wordmark attachment that `src/lib/email.ts` sends with every email. */
export const WORDMARK_CID = "zode-wordmark";

/**
 * The first word of a typed-in name, for greetings in mail sent to an address
 * the sender chose. Anything that doesn't look like a name (a URL, a phrase,
 * symbols) is dropped, so the form can't put arbitrary text in a ZODE email.
 */
export function greetingName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}\p{M}][\p{L}\p{M}'’-]{0,29}$/u.test(first) ? first : "";
}

export const color = {
  ink: "#0c0c0d",
  body: "#3a3a3e",
  muted: "#8a8a8f",
  rule: "#e6e6e1",
  ruleStrong: "#d9d9d4",
  page: "#f3f3f0",
  card: "#ffffff",
  accent: "#ffd6a0",
} as const;

// Mail clients don't load the site's self-hosted fonts, so these are system stacks.
export const font = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const text = {
  legend: {
    margin: "0 0 10px",
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: 500,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: color.muted,
  },
  paragraph: { margin: "0 0 16px", fontSize: "14px", lineHeight: "22px", color: color.body },
  fineprint: { margin: "0", fontSize: "11px", lineHeight: "17px", color: color.muted },
} satisfies Record<string, CSSProperties>;

interface LayoutProps {
  preview: string;
  /** `cid:` reference in sent mail; the /dev/emails preview passes a data URI instead. */
  logoSrc?: string;
  children: ReactNode;
}

/** The ZODE frame: black header with the wordmark, a peach rule, the card, and the footer. */
export function Layout({ preview, logoSrc = `cid:${WORDMARK_CID}`, children }: LayoutProps): ReactElement {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "32px 12px", backgroundColor: color.page, fontFamily: font.sans }}>
        <Container style={{ width: "100%", maxWidth: "600px" }}>
          <Section
            style={{
              backgroundColor: color.ink,
              borderRadius: "8px 8px 0 0",
              padding: "28px 32px 26px",
            }}
          >
            <Img src={logoSrc} width="120" height="21" alt="ZODE" style={{ display: "block", color: "#ffffff" }} />
          </Section>
          <Section style={{ backgroundColor: color.accent, height: "3px", lineHeight: "3px", fontSize: "1px" }}>
            &nbsp;
          </Section>
          <Section
            style={{
              backgroundColor: color.card,
              border: `1px solid ${color.rule}`,
              borderTop: 0,
              borderRadius: "0 0 8px 8px",
              padding: "32px",
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: "20px 32px 0" }}>
            <Text style={{ ...text.fineprint, textAlign: "center" }}>
              ZODE ·{" "}
              <Link href="https://zode.org" style={{ color: color.muted, textDecoration: "underline" }}>
                zode.org
              </Link>{" "}
              ·{" "}
              <Link href="mailto:hello@zode.org" style={{ color: color.muted, textDecoration: "underline" }}>
                hello@zode.org
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Legend({ children }: { children: ReactNode }): ReactElement {
  return <Text style={text.legend}>{children}</Text>;
}

export function Rule(): ReactElement {
  return <Hr style={{ margin: "28px 0", border: 0, borderTop: `1px solid ${color.rule}` }} />;
}

/** Label on the left, value on the right, ruled between rows, inside a bordered box. */
export function Rows({ rows }: { rows: readonly EmailRow[] }): ReactElement {
  return (
    <Section style={{ border: `1px solid ${color.ruleStrong}`, borderRadius: "6px", padding: "2px 16px" }}>
      {rows.map((row, i) => {
        const rule = i === 0 ? "0" : `1px solid ${row.total ? color.ruleStrong : color.rule}`;
        return (
          <Row key={`${row.label}-${i}`} style={{ borderTop: rule }}>
            <Column style={{ padding: "10px 12px 10px 0", verticalAlign: "top" }}>
              <Text style={{ margin: 0, fontSize: "13px", lineHeight: "19px", color: row.total ? color.ink : color.muted }}>
                {row.total ? <strong>{row.label}</strong> : row.label}
              </Text>
              {row.detail ? (
                <Text style={{ margin: "2px 0 0", fontSize: "11px", lineHeight: "16px", color: color.muted }}>
                  {row.detail}
                </Text>
              ) : null}
            </Column>
            <Column align="right" style={{ padding: "10px 0", verticalAlign: "top", whiteSpace: "nowrap" }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: row.total ? "15px" : "13px",
                  lineHeight: "19px",
                  fontWeight: row.total ? 700 : 500,
                  color: color.ink,
                }}
              >
                {row.value}
              </Text>
            </Column>
          </Row>
        );
      })}
    </Section>
  );
}
