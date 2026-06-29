import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "../_components/LegalDocument";

const COMPANY = "Cypher, Inc.";
const STATE = "Nevada";
const EMAIL = "hello@cypher.net";

export const metadata: Metadata = {
  title: "Terms | ZODE",
  description: "The terms that govern your access to and use of the ZODE website.",
};

const sections: LegalSection[] = [
  {
    heading: "1. Acceptance of Terms",
    body: [
      `These Terms (the "Terms") form a binding agreement between you and ${COMPANY} ("${COMPANY}", "we", "us", or "our") and govern your access to and use of the ZODE website and related informational pages (collectively, the "Site").`,
      "By accessing or using the Site, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you may not use the Site.",
    ],
  },
  {
    heading: "2. Eligibility",
    body: [
      "You must be at least 18 years old, or the age of majority in your jurisdiction, to use the Site. By using the Site, you represent and warrant that you meet these requirements and that you are not barred from using the Site under any applicable law.",
    ],
  },
  {
    heading: "3. Use of the Site",
    body: [
      "The Site is provided for general informational purposes about the ZODE ecosystem and related projects. We may add, change, or remove content and features at any time, and we may restrict access to parts of the Site without notice or liability.",
    ],
  },
  {
    heading: "4. Intellectual Property",
    body: [
      `The Site and all related materials, including the ZODE name, logos, text, and design, are owned by ${COMPANY} or its licensors and are protected by intellectual property laws. These Terms do not grant you any right to use our trademarks without our prior written consent.`,
      "Where portions of the underlying software are made available under open-source licenses, your use of those components is governed by those licenses.",
    ],
  },
  {
    heading: "5. Acceptable Use",
    body: [
      "You agree not to use the Site to violate any law or the rights of others; to attempt to gain unauthorized access to any system or data; to interfere with or disrupt the integrity or performance of the Site; or to reverse engineer or circumvent any security or usage limits except to the extent permitted by applicable law.",
    ],
  },
  {
    heading: "6. Third-Party Links and Services",
    body: [
      `The Site may link to or reference third-party websites, products, and services. Your use of those third parties is governed by their own terms and privacy policies, and ${COMPANY} is not responsible for their availability, accuracy, or conduct.`,
    ],
  },
  {
    heading: "7. Disclaimers",
    body: [
      `THE SITE AND ALL CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. ${COMPANY.toUpperCase()} DOES NOT WARRANT THAT THE SITE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.`,
    ],
  },
  {
    heading: "8. Limitation of Liability",
    body: [
      `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SITE.`,
    ],
  },
  {
    heading: "9. Indemnification",
    body: [
      `You agree to indemnify and hold harmless ${COMPANY} and its affiliates from any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or related to your use of the Site or your violation of these Terms or applicable law.`,
    ],
  },
  {
    heading: "10. Changes to the Site and Terms",
    body: [
      "We may modify these Terms from time to time. If we make material changes, we will update the effective date above and, where required, provide additional notice. Your continued use of the Site after changes take effect constitutes acceptance of the revised Terms.",
    ],
  },
  {
    heading: "11. Governing Law",
    body: [
      `These Terms are governed by the laws of the State of ${STATE}, without regard to its conflict-of-laws rules. Subject to any applicable mandatory law, the state and federal courts located in ${STATE} will have exclusive jurisdiction over any dispute arising out of or relating to these Terms or the Site, and you consent to personal jurisdiction in those courts.`,
      "Nothing in this section limits any non-waivable statutory rights available to you as a consumer in your country of residence.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms"
      description="The terms that govern your access to and use of the ZODE website."
      effectiveDate="Effective date: June 27, 2026"
      intro={`These Terms form a binding agreement between you and ${COMPANY} and govern your access to and use of the ZODE website. Please read them carefully. By accessing or using the Site, you agree to be bound by these Terms.`}
      sections={sections}
      contactBody={`If you have questions about these Terms, contact ${COMPANY} at ${EMAIL}.`}
      email={EMAIL}
    />
  );
}
