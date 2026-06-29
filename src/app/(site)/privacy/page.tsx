import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "../_components/LegalDocument";

const COMPANY = "Cypher, Inc.";
const EMAIL = "hello@cypher.net";

export const metadata: Metadata = {
  title: "Privacy Policy | ZODE",
  description:
    "How Cypher, Inc. handles your information when you use the ZODE website.",
};

const sections: LegalSection[] = [
  {
    heading: "1. Scope",
    body: [
      `This Privacy Policy explains how ${COMPANY} ("${COMPANY}", "we", "us", or "our") collects, uses, and shares information when you visit our website and our related informational pages (collectively, the "Site").`,
      "It does not apply to third-party websites, products, or services that we link to or that you choose to use, which are governed by their own privacy policies.",
    ],
  },
  {
    heading: "2. Information We Collect",
    body: [
      "Information you provide directly. When you contact us, for example by email, we receive your message and any details you choose to include, such as your name and email address.",
      "Usage and device information. We may collect standard technical information such as browser type, device type, referring pages, and aggregate usage data used to operate, secure, and improve the Site.",
    ],
  },
  {
    heading: "3. How We Use Information",
    body: [
      "We use information to provide, maintain, and secure the Site; to respond to your inquiries; to understand how the Site is used and to improve it; to detect, prevent, and address fraud, abuse, and security issues; and to comply with legal obligations.",
    ],
  },
  {
    heading: "4. How We Share Information",
    body: [
      `We do not sell your personal information. We share information only as follows: with service providers who process data on our behalf under confidentiality obligations; to comply with law or valid legal process; to protect the rights, safety, and security of users, the public, or ${COMPANY}; and in connection with a merger, acquisition, or sale of assets, subject to this Policy.`,
    ],
  },
  {
    heading: "5. Cookies and Analytics",
    body: [
      "The Site may use cookies or similar technologies to remember preferences and to measure aggregate traffic and performance. You can control cookies through your browser settings, though disabling them may affect some functionality.",
    ],
  },
  {
    heading: "6. Data Retention",
    body: [
      "We retain information for as long as needed to operate the Site and for legitimate business or legal purposes. We delete or anonymize information when it is no longer needed, subject to applicable law.",
    ],
  },
  {
    heading: "7. Security",
    body: [
      "We use technical and organizational measures to protect information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "8. Your Rights and Choices",
    body: [
      "Depending on where you live, you may have rights to access, correct, delete, or port your personal information, to object to or restrict certain processing, and to withdraw consent. Residents of the European Economic Area, the United Kingdom, and California, among others, may have additional rights under laws such as the GDPR and the CCPA/CPRA.",
      `To exercise these rights, contact us at ${EMAIL}. We will respond as required by applicable law, and we will not discriminate against you for exercising your rights.`,
    ],
  },
  {
    heading: "9. International Data Transfers",
    body: [
      "We may process and store information in countries other than the one in which you reside. Where required, we use appropriate safeguards for cross-border transfers of personal information.",
    ],
  },
  {
    heading: "10. Children's Privacy",
    body: [
      `The Site is not directed to children under the age required by applicable law, and we do not knowingly collect personal information from them. If you believe a child has provided us personal information, contact us at ${EMAIL} and we will take appropriate steps to delete it.`,
    ],
  },
  {
    heading: "11. Changes to this Policy",
    body: [
      "We may update this Privacy Policy from time to time. If we make material changes, we will update the effective date above and, where required, provide additional notice. Your continued use of the Site after changes take effect constitutes acceptance of the updated Policy.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How we handle your data, and the privacy-first principles behind ZODE."
      effectiveDate="Effective date: June 27, 2026"
      intro={`This Privacy Policy explains how ${COMPANY} collects, uses, and shares information when you use the ZODE website. We are committed to a privacy-first approach: we collect only what we need and never sell your personal information.`}
      sections={sections}
      contactBody={`If you have questions about this Privacy Policy or your personal information, contact ${COMPANY} at ${EMAIL}.`}
      email={EMAIL}
    />
  );
}
