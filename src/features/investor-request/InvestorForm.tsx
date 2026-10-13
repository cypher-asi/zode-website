"use client";

import { useId, useRef, useState, type CSSProperties, type FormEvent, type ReactElement } from "react";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { CHECK_SIZES, CONTACT_FIELDS, INVESTOR_TYPES, NOTE_MAX, OPPORTUNITIES, type ContactKey } from "./options";
import styles from "@/features/engineer-request/EngineerCard.module.css";

type Step = 1 | 2;

const INPUTS: Record<ContactKey, { type?: string; inputMode?: "url"; autoComplete: string; placeholder?: string }> = {
  name: { autoComplete: "name" },
  email: { type: "email", autoComplete: "email" },
  firm: { autoComplete: "organization", placeholder: "Acme Ventures" },
  title: { autoComplete: "organization-title", placeholder: "Partner" },
  firmWebsite: { inputMode: "url", autoComplete: "url", placeholder: "acme.vc" },
  phone: { type: "tel", autoComplete: "tel" },
};

const EMPTY: Record<ContactKey, string> = { name: "", email: "", firm: "", title: "", firmWebsite: "", phone: "" };

interface Props {
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}

/**
 * Two short steps in one form, like the Talk to an Engineer form: the
 * investment (investor type, opportunity and check size), then who they are.
 * Both steps stay mounted so the first step's choices submit with the second;
 * inputs are controlled so a server error doesn't clear them.
 */
export function InvestorForm({ action, pending, error }: Props): ReactElement {
  const id = useId();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [investorType, setInvestorType] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<string[]>([]);
  const [checkSize, setCheckSize] = useState<string | null>(null);
  const [contact, setContact] = useState(EMPTY);
  const [note, setNote] = useState("");
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
    if (!investorType) setStepError("Choose the kind of investor you are.");
    else if (opportunities.length === 0) setStepError("Choose company equity, project finance, or both.");
    else if (!checkSize) setStepError("Choose a typical check size.");
    else goTo(2);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === 1) {
      event.preventDefault();
      onContinue();
    }
  };

  const toggleOpportunity = (value: string) => {
    setStepError(null);
    setOpportunities((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  };

  return (
    <form action={action} onSubmit={onSubmit} className={styles.form} data-direction={direction}>
      <header className={styles.head}>
        <h2 ref={titleRef} className={styles.title} tabIndex={-1}>
          Invest in ZODE
        </h2>
        <p className={styles.lede}>Tell us about your investment and our team will follow up with materials.</p>
        <div className={styles.progress} style={{ "--p": step / 2 } as CSSProperties} aria-hidden="true">
          <span />
        </div>
      </header>

      <div className={styles.step} hidden={step !== 1}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Investor type</legend>
          <div className={styles.chips}>
            {INVESTOR_TYPES.map((option) => (
              <label key={option.id} className={styles.chip}>
                <input
                  className={styles.hiddenInput}
                  type="radio"
                  name="investorType"
                  value={option.id}
                  checked={investorType === option.id}
                  onChange={() => {
                    setStepError(null);
                    setInvestorType(option.id);
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Interested in</legend>
          <div className={styles.choices}>
            {OPPORTUNITIES.map((opportunity) => (
              <label key={opportunity.id} className={styles.choice}>
                <input
                  className={styles.hiddenInput}
                  type="checkbox"
                  name="opportunity"
                  value={opportunity.id}
                  checked={opportunities.includes(opportunity.id)}
                  onChange={() => toggleOpportunity(opportunity.id)}
                />
                <span className={styles.check} aria-hidden="true">
                  <svg viewBox="0 0 12 12">
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                </span>
                <span className={styles.choiceText}>
                  <span className={styles.choiceLabel}>{opportunity.label}</span>
                  <span className={styles.choiceDetail}>{opportunity.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>
            Typical check size <span className={styles.unit}>USD</span>
          </legend>
          <div className={styles.chips}>
            {CHECK_SIZES.map((option) => (
              <label key={option.id} className={styles.chip}>
                <input
                  className={styles.hiddenInput}
                  type="radio"
                  name="checkSize"
                  value={option.id}
                  checked={checkSize === option.id}
                  onChange={() => {
                    setStepError(null);
                    setCheckSize(option.id);
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
            <div key={field.key} className={styles.field}>
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
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor={`${id}-note`}>
              Anything else
              <span className={styles.optional}>Optional</span>
            </label>
            <textarea
              id={`${id}-note`}
              className={styles.textarea}
              name="note"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Fund focus, timing, or what you'd like to see"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
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
                Send to the team
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
