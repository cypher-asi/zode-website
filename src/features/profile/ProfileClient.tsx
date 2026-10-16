"use client";

import { useEffect, useState, type ReactElement } from "react";
import { CabinArt } from "@/features/zode-drawings/CabinArt";

const noop = () => {};
const COPIED_MS = 1800;

/** The compute pod drawing, as on the deck's solution slide; nothing on the sheet reacts to its hotspots. */
export function PodDrawing(): ReactElement {
  return <CabinArt pod="compute" active={null} onActive={noop} />;
}

/** Puts `text` on the clipboard; whether it did. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The async clipboard is refused off HTTPS and in unfocused frames; copy from a selection instead.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

/** Copies the link to `path` (the profile's by default), reading "Copied" for a moment after. */
export function ShareButton({
  className,
  srOnly,
  path = "/company-profile",
}: {
  className: string;
  srOnly: string;
  path?: string;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyText(`${window.location.origin}${path}`)) setCopied(true);
  };

  return (
    <>
      <button type="button" className={className} onClick={copy}>
        {copied ? "Copied" : "Share"}
      </button>
      <span className={srOnly} aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
