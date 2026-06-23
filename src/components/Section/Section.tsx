import type { ReactElement } from "react";
import type { SectionContent } from "@/content/sections";
import styles from "./Section.module.css";

export function Section({ section }: { section: SectionContent }): ReactElement {
  return (
    <section id={section.id} className={styles.section} aria-label={section.label}>
      <div className={styles.inner}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
        <p className={styles.lede}>{section.lede}</p>
        <div className={styles.body}>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
