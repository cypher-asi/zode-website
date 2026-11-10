"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import type { AddressLines, RoomBanking } from "./banking";
import { CopyButton } from "./CopyButton";
import styles from "./Banking.module.css";

const METHODS = [
  ["domestic", "US deposit"],
  ["international", "International deposit"],
  ["stablecoin", "Stablecoin"],
] as const;

type Method = (typeof METHODS)[number][0];

const masked = (accountNumber: string): string => `•••• ${accountNumber.slice(-4)}`;

/** A label over its value, with a button that copies `copy`, the value itself unless set. */
function Field({
  label,
  value,
  copy,
  mono = false,
}: {
  label: string;
  value: string | AddressLines;
  copy?: string;
  mono?: boolean;
}): ReactElement {
  const lines = typeof value === "string" ? [value] : value;
  return (
    <div className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value} data-mono={mono || undefined}>
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </dd>
      <dd className={styles.copy}>
        <CopyButton text={copy ?? lines.join("\n")} label={label.toLowerCase()} />
      </dd>
    </div>
  );
}

function Group({ heading, children }: { heading?: string; children: ReactNode }): ReactElement {
  return (
    <div className={styles.group}>
      {heading ? <h3 className={styles.groupHeading}>{heading}</h3> : null}
      <dl className={styles.fields}>{children}</dl>
    </div>
  );
}

/**
 * Where to send the room's funds: the account at the top, then a toggle
 * between a US deposit, an international wire and a stablecoin transfer, each
 * with the details its sender needs and a copy button on every one.
 */
export function BankingView({ banking }: { banking: RoomBanking }): ReactElement {
  const [method, setMethod] = useState<Method>("domestic");
  const { account, domestic, international, stablecoin } = banking;

  return (
    <div className={styles.banking}>
      <section className={styles.card} aria-labelledby="banking-account">
        <header className={styles.account}>
          <p className={styles.eyebrow}>Account</p>
          <h2 id="banking-account" className={styles.accountName}>
            {account.label} <span className={styles.accountNumber}>{masked(account.accountNumber)}</span>
          </h2>
        </header>

        <div className={styles.modes} role="group" aria-label="Deposit method">
          {METHODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={styles.mode}
              aria-pressed={method === value}
              onClick={() => setMethod(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {method === "domestic" ? (
          <Group>
            <Field label="Beneficiary name" value={domestic.beneficiaryName} />
            <Field label="Account type" value={domestic.accountType} />
            <Field label="Account number" value={masked(account.accountNumber)} copy={account.accountNumber} mono />
            <Field label="Routing number" value={domestic.routingNumber} mono />
            <Field label="Bank address" value={[domestic.bankName, ...domestic.bankAddress]} />
          </Group>
        ) : method === "international" ? (
          <>
            <Group heading="Receiving bank">
              <Field label="Bank name" value={international.bankName} />
              <Field label="BIC/SWIFT code" value={international.swift} mono />
              <Field label="Bank address" value={international.bankAddress} />
            </Group>
            <Group heading="Beneficiary">
              <Field label="Beneficiary name" value={international.beneficiaryName} />
              <Field label="Account number" value={account.accountNumber} mono />
              <Field label="Beneficiary address" value={international.beneficiaryAddress} />
            </Group>
          </>
        ) : (
          <>
            <Group>
              <Field label="Stablecoin" value={stablecoin.coin} />
              <Field label="Network" value={stablecoin.network} />
              <Field label="Deposit address" value={stablecoin.address} mono />
            </Group>
            <p className={styles.warning} role="note">
              <strong>Supported stablecoins only.</strong> Other cryptocurrencies like ETH or BTC sent to this address
              cannot be recovered.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
