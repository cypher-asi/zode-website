"use client";

import { useEffect, useState, type ReactElement } from "react";
import { CabinArt } from "@/features/zode-drawings/CabinArt";

const noop = () => {};
const COPIED_MS = 1800;

/** The compute pod drawing, as on the deck's solution slide; nothing on the sheet reacts to its hotspots. */
export function PodDrawing(): ReactElement {
  return <CabinArt pod="compute" active={null} onActive={noop} />;
}

/** Copies the profile's link, reading "Copied" for a moment after. */
export function ShareButton({ className, srOnly }: { className: string; srOnly: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const url = `${window.location.origin}/company-profile`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The async clipboard is refused off HTTPS and in unfocused frames; copy from a selection instead.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      if (ok) setCopied(true);
    }
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
