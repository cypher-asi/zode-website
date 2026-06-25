import type { ReactElement } from "react";
import type { SectionContent } from "@/content/sections";
import { ListCard } from "@/components/Card";
import styles from "./TeamPanel.module.css";

function LinkIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function XIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function HourglassIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h12" />
      <path d="M6 22h12" />
      <path d="M6 2c0 4 3 6 6 8 3-2 6-4 6-8" />
      <path d="M6 22c0-4 3-6 6-8 3 2 6 4 6 8" />
    </svg>
  );
}

export function TeamPanel({
  section,
}: {
  section: SectionContent;
}): ReactElement | null {
  const data = section.team;
  if (!data) return null;

  const { founder, timeline, companies } = data;

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
      </header>

      <div className={styles.grid}>
        <div className={styles.bio}>
          <p className={styles.role}>{founder.role}</p>
          <p className={styles.founderName}>{founder.name}</p>
          <p className={styles.founderBio}>{founder.bio}</p>
          <p className={styles.achievementsLabel}>{founder.achievementsLabel}</p>
          <ul className={styles.achievements}>
            {founder.achievements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <ol className={styles.timeline} aria-label="Timeline">
          {timeline.map((entry) => (
            <li key={entry.year} className={styles.timelineEntry}>
              <div className={styles.timelineYear}>
                <span className={styles.year}>{entry.year}</span>
                {entry.label && (
                  <span className={styles.yearLabel}>{entry.label}</span>
                )}
              </div>
              <ul className={styles.timelineEvents}>
                {entry.events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.companies}>
        {companies.map((company) => (
          <ListCard
            key={company.name}
            title={company.name}
            className={styles.companyCard}
          >
            <p className={styles.companyDescription}>{company.description}</p>
            <div className={styles.companyMeta}>
              <a
                className={styles.companyLink}
                href={company.url.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkIcon />
                <span>{company.url.label}</span>
              </a>
              <a
                className={styles.companyLink}
                href={company.x.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                <XIcon />
                <span>{company.x.label}</span>
              </a>
              <span className={styles.companyYear}>
                <HourglassIcon />
                <span>{company.year}</span>
              </span>
            </div>
          </ListCard>
        ))}
      </div>
    </div>
  );
}
