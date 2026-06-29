"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const RECIPIENT = "hello@zode.org";

const GPU_OPTIONS = [
  "1 - 8 GPUs",
  "8 - 32 GPUs",
  "32 - 128 GPUs",
  "128 - 512 GPUs",
  "512+ GPUs",
] as const;

const SPEND_OPTIONS = [
  "Under $10k / mo",
  "$10k - $50k / mo",
  "$50k - $250k / mo",
  "$250k - $1M / mo",
  "$1M+ / mo",
] as const;

const START_OPTIONS = [
  "Immediately",
  "Within a week",
  "This month",
  "This quarter",
  "Just exploring",
] as const;

export function RequestComputeForm(): ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [gpus, setGpus] = useState("");
  const [spend, setSpend] = useState("");
  const [start, setStart] = useState("");
  const [workload, setWorkload] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const subject = `Compute request — ${company || name}`;
    const body = [
      `Name: ${name}`,
      `Work email: ${email}`,
      `Company: ${company}`,
      `GPUs needed: ${gpus}`,
      `Monthly compute spend: ${spend}`,
      `Start: ${start}`,
      ``,
      `What they're running:`,
      workload,
    ].join("\n");

    window.location.href = `mailto:${RECIPIENT}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Request Compute</h2>
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
            <label className={styles.label} htmlFor="gpus">
              GPUs needed *
            </label>
            <select
              id="gpus"
              name="gpus"
              className={styles.select}
              required
              value={gpus}
              onChange={(e) => setGpus(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {GPU_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="spend">
              Monthly compute spend *
            </label>
            <select
              id="spend"
              name="spend"
              className={styles.select}
              required
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {SPEND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="start">
              When can you start? *
            </label>
            <select
              id="start"
              name="start"
              className={styles.select}
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {START_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="workload">
              What are you running?
            </label>
            <textarea
              id="workload"
              name="workload"
              className={styles.textarea}
              placeholder="e.g. training a vision model, dataset sits in AWS eu-west-1, want 16× H100 for about a month"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className={styles.submit}>
          Request Compute <span aria-hidden="true">→</span>
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
