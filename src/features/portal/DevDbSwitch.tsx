"use client";

import { useOptimistic, useTransition, type ReactElement } from "react";
import type { DbTarget } from "@/lib/db";
import { setDevDb } from "./devDb";
import styles from "./DevDbSwitch.module.css";

const OPTIONS: readonly { target: DbTarget; label: string }[] = [
  { target: "dev", label: "Dev DB" },
  { target: "prod", label: "Prod DB" },
];

/** Local development only: flips the server between the dev and prod databases. */
export function DevDbSwitch({ current }: Readonly<{ current: DbTarget }>): ReactElement {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useOptimistic(current);

  return (
    <div
      className={styles.switch}
      role="radiogroup"
      aria-label="Database"
      data-target={target}
      aria-busy={pending || undefined}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.target}
          type="button"
          role="radio"
          aria-checked={target === option.target}
          className={styles.option}
          disabled={pending}
          onClick={() => {
            if (option.target === target) return;
            startTransition(async () => {
              setTarget(option.target);
              await setDevDb(option.target);
            });
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
