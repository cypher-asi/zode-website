"use client";

import { useId, useRef, useState, type CSSProperties, type FormEvent, type ReactElement } from "react";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { CONTACT_FIELDS, DEPLOYMENT_SIZES, INTERESTS, type ContactKey } from "./options";
import styles from "./EngineerCard.module.css";

type Step = 1 | 2;

const INPUTS: Record<ContactKey, { type?: string; inputMode?: "url"; autoComplete: string; placeholder?: string }> = {
  company: { inputMode: "url", autoComplete: "url", placeholder: "acme.com" },
  name: { autoComplete: "name" },
  title: { autoComplete: "organization-title", placeholder: "Head of Infrastructure" },
  phone: { type: "tel", autoComplete: "tel" },
  email: { type: "email", autoComplete: "email" },
};

const EMPTY: Record<ContactKey, string> = { company: "", name: "", title: "", phone: "", email: "" };

interface Props {
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}

/**
 * Two short steps in one form: what they need (interest cards and node-count
 * chips), then who they are. Both steps stay mounted so the first step's
 * choices submit with the second; inputs are controlled so a server error
 * doesn't clear them.
 */
export function EngineerForm({ action, pending, error }: Props): ReactElement {
  const id = useId();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [interests, setInterests] = useState<string[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [contact, setContact] = useState(EMPTY);
  const [stepError, setStepError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const goTo = (next: Step) => {
    setDirection(next > step ? "next" : "back");
    setStep(next);
    setStepError(null);
    requestAnimationFrame(() => {
      // On touch screens, focusing a field would throw up the keyboard before they've seen the step.
      if (next === 2 && window.matchMedia("(pointer: fine)").matches) firstFieldRef.current?.focus();
      else titleRef.current?.focus();
    });
  };

  const onContinue = () => {
    if (interests.length === 0) setStepError("Choose buying, renting, or both.");
    else if (!size) setStepError("Choose a deployment size.");
    else goTo(2);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === 1) {
      event.preventDefault();
      onContinue();
    }
  };

  const toggleInterest = (value: string) => {
    setStepError(null);
    setInterests((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  };

  return (
    <form action={action} onSubmit={onSubmit} className={styles.form} data-direction={direction}>
      <header className={styles.head}>
        <h2 ref={titleRef} className={styles.title} tabIndex={-1}>
          Talk to an Engineer
        </h2>
        <p className={styles.lede}>We will email or text you to schedule a meeting.</p>
        <div className={styles.progress} style={{ "--p": step / 2 } as CSSProperties} aria-hidden="true">
          <span />
        </div>
      </header>

      <div className={styles.step} hidden={step !== 1}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Interested in</legend>
          <div className={styles.choices}>
            {INTERESTS.map((interest) => (
              <label key={interest.id} className={styles.choice}>
                <input
                  className={styles.hiddenInput}
                  type="checkbox"
                  name="interest"
                  value={interest.id}
                  checked={interests.includes(interest.id)}
                  onChange={() => toggleInterest(interest.id)}
                />
                <span className={styles.check} aria-hidden="true">
                  <svg viewBox="0 0 12 12">
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                </span>
                <span className={styles.choiceText}>
                  <span className={styles.choiceLabel}>{interest.label}</span>
                  <span className={styles.choiceDetail}>{interest.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>
            Deployment size <span className={styles.unit}>Nodes</span>
          </legend>
          <div className={styles.chips}>
            {DEPLOYMENT_SIZES.map((option) => (
              <label key={option.id} className={styles.chip}>
                <input
                  className={styles.hiddenInput}
                  type="radio"
                  name="size"
                  value={option.id}
                  checked={size === option.id}
                  onChange={() => {
                    setStepError(null);
                    setSize(option.id);
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.message} role="alert">
          {stepError ? <p className={styles.error}>{stepError}</p> : null}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onContinue}>
            Continue
            <Arrow />
          </button>
        </div>
      </div>

      <div className={styles.step} hidden={step !== 2}>
        <div className={styles.fields}>
          {CONTACT_FIELDS.map((field, n) => (
            <div key={field.key} className={field.key === "company" ? `${styles.field} ${styles.full}` : styles.field}>
              <label className={styles.label} htmlFor={`${id}-${field.key}`}>
                {field.label}
                {field.required ? null : <span className={styles.optional}>Optional</span>}
              </label>
              <input
                ref={n === 0 ? firstFieldRef : undefined}
                id={`${id}-${field.key}`}
                className={styles.input}
                name={field.key}
                type={INPUTS[field.key].type ?? "text"}
                inputMode={INPUTS[field.key].inputMode}
                autoComplete={INPUTS[field.key].autoComplete}
                placeholder={INPUTS[field.key].placeholder}
                required={field.required}
                maxLength={field.max}
                value={contact[field.key]}
                onChange={(event) => setContact((c) => ({ ...c, [field.key]: event.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* Hidden from people; bots that fill every field give themselves away. */}
        <div className={styles.trap} aria-hidden="true">
          <label>
            Website
            <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <div className={styles.message} role="alert">
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => goTo(1)} disabled={pending}>
            Back
          </button>
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Sending
              </>
            ) : (
              <>
                Send to an engineer
                <Arrow />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function Arrow(): ReactElement {
  return (
    <svg className={styles.arrow} viewBox="0 0 14 10" aria-hidden="true">
      <path d="M1 5h11M8.5 1.5L12 5 8.5 8.5" />
    </svg>
  );
}
