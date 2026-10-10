"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import {
  BUY_GPU_OPTIONS,
  BUY_SPEND_OPTIONS,
  BUY_START_OPTIONS,
  HONEYPOT_FIELD,
  buildMailtoUrl,
} from "@/lib/leads";
import { postLead } from "@/lib/leads-submit";
import { openMailDraft } from "@/lib/mailto";
import { SubmittedPanel } from "./SubmittedPanel";
import styles from "./page.module.css";

type Status = "idle" | "submitting" | "success" | "fallback";

export function RequestComputeForm(): ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [gpus, setGpus] = useState("");
  const [spend, setSpend] = useState("");
  const [start, setStart] = useState("");
  const [workload, setWorkload] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [mailtoUrl, setMailtoUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");

    const values = { name, email, company, gpus, spend, start, workload };
    const ok = await postLead({ type: "buy", ...values, [HONEYPOT_FIELD]: honeypot });

    if (ok) {
      setStatus("success");
      return;
    }

    // Capture failed — hand the lead to a pre-filled mail draft so it still
    // reaches a human, then show the draft/fallback panel.
    const url = buildMailtoUrl("buy", values);
    setMailtoUrl(url);
    openMailDraft(url);
    setStatus("fallback");
  }

  if (status === "success") {
    return (
      <div className={styles.card}>
        <div className={styles.confirmation}>
          <span className={styles.confirmationIcon} aria-hidden="true">
            <BigCheckIcon />
          </span>
          <h2 className={styles.confirmationTitle}>Request received</h2>
          <p className={styles.confirmationText}>
            Thanks — an engineer will reply to your email, usually within a few
            hours.
          </p>
        </div>
      </div>
    );
  }

  if (status === "fallback") {
    return (
      <div className={styles.card}>
        <SubmittedPanel mailtoUrl={mailtoUrl} onReset={() => setStatus("idle")} />
      </div>
    );
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
        {/* Honeypot: hidden from users, catches bots. Never rendered visibly. */}
        <input
          type="text"
          name={HONEYPOT_FIELD}
          className={styles.honeypot}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />

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
              {BUY_GPU_OPTIONS.map((option) => (
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
              {BUY_SPEND_OPTIONS.map((option) => (
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
              {BUY_START_OPTIONS.map((option) => (
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

        <button type="submit" className={styles.submit} disabled={status === "submitting"}>
          {status === "submitting" ? (
            "Sending…"
          ) : (
            <>
              Request Compute <span aria-hidden="true">→</span>
            </>
          )}
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

function BigCheckIcon(): ReactElement {
  return (
    <svg
      width="28"
      height="28"
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
