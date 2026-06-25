import type { ReactElement } from "react";
import type { SectionContent } from "@/content/sections";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./ContactPanel.module.css";

export function ContactPanel({
  section,
}: {
  section: SectionContent;
}): ReactElement {
  const email = section.contact?.email ?? "";

  return (
    <SlideLayout
      id={section.id}
      ariaLabel={section.label}
      middleClassName={styles.contact}
      middle={
        <div className={styles.inner}>
          {/* The wordmark ships as white lines on transparency and inverts to
              black on the light content panel via the shared --logo-invert. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.wordmark} src="/wordmark.png" alt="ZODE" />
        </div>
      }
      bottomClassName={styles.contact}
      bottom={
        email ? (
          <a className={styles.email} href={`mailto:${email}`}>
            {email}
          </a>
        ) : undefined
      }
    />
  );
}
