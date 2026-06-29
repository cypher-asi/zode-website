import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { ProvideComputeForm } from "./ProvideComputeForm";
import styles from "../buy-compute/page.module.css";

export const metadata: Metadata = {
  title: "Give Compute | ZODE",
  description:
    "Contribute idle hardware to the grid. Set your own availability and earn on metered capacity.",
};

const COMPLIANCE = [
  "ISO/IEC 27001:2022",
  "SOC 2",
  "NIS2",
  "99.99% Uptime SLA",
] as const;

const FEATURES = [
  {
    title: "Earn on idle GPUs",
    body: "turn unused cycles into recurring revenue, metered by the second.",
  },
  {
    title: "You stay in control",
    body: "set your own availability windows, pricing floors, and workload limits.",
  },
  {
    title: "Painless onboarding",
    body: "we handle scheduling, billing, and secure routing to your nodes.",
  },
] as const;

const TRUST = ["Revenue share", "You set availability", "No upfront cost"] as const;

export default function GiveComputePage(): ReactElement {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <section className={styles.compliance}>
          <p className={styles.complianceLabel}>
            A vetted, secure provider network
          </p>
          <div className={styles.badgeRow}>
            {COMPLIANCE.map((item) => (
              <span key={item} className={styles.badge}>
                <ShieldIcon />
                {item}
              </span>
            ))}
          </div>
        </section>

        <div className={styles.layout}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Get started</p>
            <h1 className={styles.heading}>
              Put idle
              <br />
              hardware to work.
            </h1>
            <p className={styles.description}>
              Tell us about your fleet and we&apos;ll plug spare capacity into
              the grid. You decide when it&apos;s available, and earn on every
              metered second it runs.
            </p>

            <div className={styles.features}>
              {FEATURES.map((feature) => (
                <div key={feature.title} className={styles.feature}>
                  <span className={styles.featureIcon}>
                    <BoltIcon />
                  </span>
                  <p className={styles.featureText}>
                    <strong>{feature.title}</strong> — {feature.body}
                  </p>
                </div>
              ))}
            </div>

            <div className={styles.trustRow}>
              {TRUST.map((item) => (
                <span key={item} className={styles.trustItem}>
                  <CheckIcon />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <ProvideComputeForm />
        </div>
      </div>
    </div>
  );
}

function IconWrap({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ShieldIcon(): ReactElement {
  return (
    <span className={styles.badgeIcon}>
      <IconWrap>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </IconWrap>
    </span>
  );
}

function BoltIcon(): ReactElement {
  return (
    <IconWrap>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </IconWrap>
  );
}

function CheckIcon(): ReactElement {
  return (
    <span className={styles.trustIcon}>
      <IconWrap>
        <path d="M20 6 9 17l-5-5" />
      </IconWrap>
    </span>
  );
}
