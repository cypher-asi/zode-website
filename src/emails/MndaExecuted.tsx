import { Heading, Link, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";
import { Layout, Legend, Rule, color, greetingName, text } from "./ui";

export interface MndaExecutedProps {
  /** The counterparty's signer gets a copy for their records; the team gets a notification. */
  audience: "signer" | "team";
  agreementId: string;
  entityName: string;
  entityType: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  zodeSignerName: string;
  zodeSignerTitle: string;
  /** e.g. "October 11, 2026". */
  effectiveDate: string;
  /** Set when signed to join a data room. */
  roomName: string | null;
}

type Props = MndaExecutedProps & { logoSrc?: string };

export const mndaExecutedSubject = (props: MndaExecutedProps): string =>
  props.audience === "signer"
    ? `Your mutual NDA with ZODE (${props.entityName})`
    : `MNDA signed: ${props.entityName}`;

/** Sent to both parties when an MNDA is executed, with the signed PDF attached. */
export default function MndaExecuted(props: Props): ReactElement {
  const signer = props.audience === "signer";
  const firstName = greetingName(props.signerName);

  // Stacked rather than <Rows>, whose values don't wrap; entity names can be long.
  const details: { label: string; value: string }[] = [
    { label: "Entity", value: `${props.entityName}, a ${props.entityType}` },
    { label: "Signed for the entity by", value: `${props.signerName}, ${props.signerTitle} (${props.signerEmail})` },
    { label: "Signed for ZODE Inc. by", value: `${props.zodeSignerName}, ${props.zodeSignerTitle}` },
    { label: "Effective", value: props.effectiveDate },
    ...(props.roomName ? [{ label: "Data room", value: props.roomName }] : []),
    { label: "Agreement ID", value: props.agreementId },
  ];

  return (
    <Layout
      preview={
        signer
          ? "Your executed Mutual Nondisclosure Agreement with ZODE is attached."
          : `${props.signerName} signed the MNDA for ${props.entityName}.`
      }
      logoSrc={props.logoSrc}
    >
      <Legend>Mutual NDA executed</Legend>
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: color.ink }}
      >
        {signer ? `You're all set${firstName ? `, ${firstName}` : ""}.` : `${props.entityName} signed the MNDA.`}
      </Heading>
      <Text style={text.paragraph}>
        {signer
          ? `The Mutual Nondisclosure Agreement between ZODE Inc. and ${props.entityName} has been signed by both parties. The executed copy is attached; keep it for your records.`
          : `${props.signerName} (${props.signerEmail}) signed ZODE's standard Mutual Nondisclosure Agreement for ${props.entityName}, and ZODE's countersignature was applied. The executed copy is attached.`}
      </Text>

      <Section style={{ border: `1px solid ${color.ruleStrong}`, borderRadius: "6px", padding: "6px 16px" }}>
        {details.map((detail, i) => (
          <Section key={detail.label} style={{ padding: "8px 0", borderTop: i === 0 ? "0" : `1px solid ${color.rule}` }}>
            <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: color.muted }}>{detail.label}</Text>
            <Text style={{ margin: "2px 0 0", fontSize: "14px", lineHeight: "20px", color: color.ink }}>{detail.value}</Text>
          </Section>
        ))}
      </Section>

      <Rule />

      <Text style={{ ...text.fineprint, margin: 0 }}>
        {signer ? (
          <>
            Didn&apos;t sign this? Reply to this email or write to{" "}
            <Link href="mailto:hello@zode.org" style={{ color: color.muted, textDecoration: "underline" }}>
              hello@zode.org
            </Link>{" "}
            and we&apos;ll look into it.
          </>
        ) : (
          "Replies go to the signer. The last page of the PDF records how and when each party signed."
        )}
      </Text>
    </Layout>
  );
}
