import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { RequestComputeForm } from "./RequestComputeForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Buy Compute | ZODE",
  description:
    "Request compute on the grid. We match your workload to live capacity and wire a private link to your data.",
};

const COMPLIANCE = [
  "ISO/IEC 27001:2022",
  "SOC 2",
  "NIS2",
  "99.99% Uptime SLA",
] as const;

const FEATURES = [
  {
    title: "Capacity match",
    body: "we find the GPUs you need across the network, today.",
  },
  {
    title: "Private link setup",
    body: "connect to your data in AWS, GCP, Azure, K8s or on-prem.",
  },
  {
    title: "Launch fast",
    body: "first instance live the same day, billed by the second.",
  },
] as const;

const TRUST = ["Reply within hours", "No lock-in", "No hidden fees"] as const;

export default function BuyComputePage(): ReactElement {
  return (
    <div className={styles.page}>
      <section className={styles.compliance}>
        <p className={styles.complianceLabel}>
          Enterprise-grade security &amp; compliance
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
            Tell us what
            <br />
            you&apos;re running.
          </h1>
          <p className={styles.description}>
            We&apos;ll match your workload to live capacity and wire the private
            link to your data. A real engineer replies — usually within a few
            hours.
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

        <RequestComputeForm />
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
