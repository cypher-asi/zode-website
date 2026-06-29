"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import styles from "../buy-compute/page.module.css";

const RECIPIENT = "hello@zode.org";

const HARDWARE_OPTIONS = [
  "NVIDIA H100",
  "NVIDIA A100",
  "NVIDIA L40S / L40",
  "NVIDIA RTX 4090",
  "AMD MI300X",
  "Other / mixed fleet",
] as const;

const COUNT_OPTIONS = [
  "1 - 8 GPUs",
  "8 - 32 GPUs",
  "32 - 128 GPUs",
  "128 - 512 GPUs",
  "512+ GPUs",
] as const;

const AVAIL_OPTIONS = [
  "Immediately",
  "Within a week",
  "This month",
  "This quarter",
  "Just exploring",
] as const;

export function ProvideComputeForm(): ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [hardware, setHardware] = useState("");
  const [count, setCount] = useState("");
  const [availability, setAvailability] = useState("");
  const [setup, setSetup] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const subject = `Compute offer — ${company || name}`;
    const body = [
      `Name: ${name}`,
      `Work email: ${email}`,
      `Company: ${company}`,
      `Hardware type: ${hardware}`,
      `GPUs available: ${count}`,
      `Available from: ${availability}`,
      ``,
      `About their setup:`,
      setup,
    ].join("\n");

    window.location.href = `mailto:${RECIPIENT}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Provide Compute</h2>
        <span className={styles.slaTag}>
          <CheckIcon />
          Typical reply under 5h
        </span>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Name *
            </label>
            <input
              id="name"
              name="name"
              className={styles.input}
              placeholder="Jane Doe"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Work email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.input}
              placeholder="jane@company.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="company">
              Company *
            </label>
            <input
              id="company"
              name="company"
              className={styles.input}
              placeholder="Your company"
              autoComplete="organization"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="hardware">
              Hardware type *
            </label>
            <select
              id="hardware"
              name="hardware"
              className={styles.select}
              required
              value={hardware}
              onChange={(e) => setHardware(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {HARDWARE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="count">
              GPUs available *
            </label>
            <select
              id="count"
              name="count"
              className={styles.select}
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {COUNT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="availability">
              Available from *
            </label>
            <select
              id="availability"
              name="availability"
              className={styles.select}
              required
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {AVAIL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="setup">
              Tell us about your setup
            </label>
            <textarea
              id="setup"
              name="setup"
              className={styles.textarea}
              placeholder="e.g. 24× H100 in a Tier III facility in Frankfurt, 100 Gbps uplink, idle nights and weekends"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className={styles.submit}>
          Provide Compute <span aria-hidden="true">→</span>
        </button>

        <p className={styles.disclaimer}>
          Sending this request means you accept ZODE&apos;s{" "}
          <Link className={styles.disclaimerLink} href="/terms">
            Terms
          </Link>{" "}
          and{" "}
          <Link className={styles.disclaimerLink} href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

function CheckIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
