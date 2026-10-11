/**
 * Deliberately narrower than RFC 5322: addresses end up in mailto: links and
 * email headers, so the local part excludes `?`, `&`, `%`, quotes and angle
 * brackets, and the domain must be dotted ASCII labels (IDNs as punycode).
 */
const EMAIL_RE = /^[A-Za-z0-9._+'-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9]$/;

export const MAX_EMAIL_LENGTH = 254;

export const isEmail = (value: string): boolean => value.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(value);

/** Turns control characters (newlines included) into spaces; they have no place in single-line fields or email subjects. */
export const singleLine = (value: string): string => value.replace(/\p{Cc}+/gu, " ").replace(/ {2,}/g, " ").trim();

/** Keeps line breaks and tabs in multi-line text, and drops every other control character. */
export const multiLine = (value: string): string => value.replace(/[^\P{Cc}\n\t]/gu, "").trim();
