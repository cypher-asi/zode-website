/**
 * Builds a `mailto:` URL from structured parts. Uses CRLF line breaks in the
 * body for the broadest mail-client compatibility.
 */
export function buildMailto({
  recipient,
  subject,
  bodyLines,
}: {
  recipient: string;
  subject: string;
  bodyLines: readonly string[];
}): string {
  const body = bodyLines.join("\r\n");
  return `mailto:${recipient}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Opens a `mailto:` draft by clicking a transient anchor rather than assigning
 * `window.location.href`. This keeps the current page intact when the browser
 * has no registered mail handler (in which case nothing visibly happens), so
 * the form can show its own confirmation and fallback instead of appearing
 * broken.
 */
export function openMailDraft(url: string): void {
  if (typeof document === "undefined") return;

  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
