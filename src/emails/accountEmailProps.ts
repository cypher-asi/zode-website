/** Minimal shape of a new account, so the /dev/emails preview needn't import server-only code. */
interface AccountFields {
  userId: string;
  email: string;
  displayName: string;
  primaryZid: string;
}

export interface AccountEmailProps {
  userId: string;
  name: string;
  email: string;
  zid: string;
  /** As typed at registration; empty when the default invite was used. */
  inviteCode: string;
  registeredAt: string;
}

const REGISTERED_AT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/** A new account as the plain strings its emails show. */
export function accountEmailProps(account: AccountFields, inviteCode: string, registeredAt = new Date()): AccountEmailProps {
  return {
    userId: account.userId,
    name: account.displayName,
    email: account.email,
    zid: account.primaryZid,
    inviteCode,
    registeredAt: `${REGISTERED_AT.format(registeredAt)} UTC`,
  };
}
