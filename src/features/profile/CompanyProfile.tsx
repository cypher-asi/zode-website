import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { Logo } from "@/features/deck/slides";
import { PrincipleArt } from "@/features/home/principles/PrincipleArt";
import { PRINCIPLES } from "@/features/home/principles/principles";
import { SITE_URL } from "@/lib/site";
import {
  CONTACT,
  CUSTOMERS,
  LEDE,
  NETWORK_TITLE,
  PDF,
  PIPELINE_STATS,
  PRINCIPLE_LINES,
  RESOURCES,
  SOLUTION,
  TAGLINE,
  TEAM,
  TRACTION,
  VENTURE_LINES,
} from "./profile";
import { PodDrawing, ShareButton } from "./ProfileClient";
import styles from "./CompanyProfile.module.css";

const absolute = (href: string) => new URL(href, SITE_URL).href;
/** A link as it reads on paper: no scheme, no trailing slash. */
const display = (href: string) => absolute(href).replace(/^https?:\/\//, "").replace(/\/$/, "");

/** A printed link that wraps only after its slashes. */
function Url({ href }: { href: string }): ReactElement {
  const parts = display(href).split("/");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className={styles.urlPart}>
          {i < parts.length - 1 ? `${part}/` : part}
          {i < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}

/** Square units every logo covers, as on the deck, so long and compact marks weigh the same. */
const LOGO_AREA = 7;

function LogoMark({ logo }: { logo: Logo }): ReactElement {
  const height = Math.sqrt(LOGO_AREA / logo.aspect) * (logo.scale ?? 1);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the SVG logos are sized by their aspect, not a fixed box
    <img
      src={logo.src}
      alt={logo.name}
      style={{ "--h": height, "--shift": 0.5 - (logo.center ?? 0.5) } as CSSProperties}
    />
  );
}

/** Logos under their label, or beside it with `inline`. */
function LogoRow({ label, logos, inline }: { label: string; logos: readonly Logo[]; inline?: boolean }): ReactElement {
  return (
    <div className={styles.logoRow} data-inline={inline || undefined}>
      <span className={styles.rowLabel}>{label}</span>
      <ul className={styles.logos}>
        {logos.map((logo) => (
          <li key={logo.name}>
            <LogoMark logo={logo} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  index,
  title,
  className,
  children,
}: {
  index: string;
  title: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={className ? `${styles.section} ${className}` : styles.section}>
      <h2 className={styles.label}>
        <span className={styles.index}>{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ value, label, large }: { value: string; label: string; large?: boolean }): ReactElement {
  return (
    <div className={styles.stat} data-large={large || undefined}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

/**
 * ZODE's company profile on one US Letter sheet: what it does and its
 * principles, the capacity pipeline, customers, leadership, resources and
 * contact. On screen the sheet sits on paper with buttons to share its link
 * and download its PDF;
 * printed, the sheet is the page.
 */
export function CompanyProfile(): ReactElement {
  const { founder, network } = TEAM;
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <ShareButton className={styles.action} srOnly={styles.srOnly} />
        <a className={styles.action} href={PDF.href} download={PDF.filename}>
          Export PDF
        </a>
      </div>
      <article className={styles.sheet}>
        <header className={styles.masthead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the wordmark SVG scales to the masthead's height */}
          <img className={styles.wordmark} src="/brand/zode-wordmark-black.svg" alt="ZODE" />
        </header>

        <div className={styles.pod}>
          <PodDrawing />
        </div>

        <Section index="01" title="What ZODE does" className={styles.what}>
          <div className={styles.intro}>
            <h1 className={styles.title}>{TAGLINE}</h1>
            <div className={styles.introCopy}>
              <p className={styles.lede}>{LEDE}</p>
              <ul className={styles.facts}>
                {SOLUTION.facts.map((fact) => (
                  <li key={fact.label}>
                    <Stat value={fact.value} label={fact.label} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ul className={styles.principles}>
            {PRINCIPLES.map((principle, i) => (
              <li key={principle.id} className={styles.principle}>
                <div className={styles.principleHead}>
                  <h3 className={styles.principleTitle}>
                    <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
                    {principle.title}
                  </h3>
                  <div className={styles.principleArt}>
                    <PrincipleArt id={principle.id} />
                  </div>
                </div>
                <p className={styles.small}>{PRINCIPLE_LINES[principle.id]}</p>
              </li>
            ))}
          </ul>
        </Section>

        <div className={styles.pair}>
          <Section index="02" title="Capacity pipeline">
            <ul className={styles.cards}>
              {PIPELINE_STATS.map((stat) => (
                <li key={stat.label} className={styles.card}>
                  <Stat value={stat.value} label={stat.label} large />
                </li>
              ))}
            </ul>
          </Section>

          <Section index="03" title="Customers">
            <div className={styles.stats}>
              <Stat value={TRACTION.contracted.value} label={TRACTION.contracted.label} large />
              <Stat value={TRACTION.loi.value} label={TRACTION.loi.label} large />
            </div>
            <div className={styles.logoRows}>
              {CUSTOMERS.map((group) => (
                <LogoRow key={group.label} label={group.label} logos={group.logos} />
              ))}
            </div>
          </Section>
        </div>

        <Section index="04" title="Leadership">
          <div className={styles.team}>
            <div className={styles.column}>
              <h3 className={`${styles.person} ${styles.columnHead}`}>
                {founder.name}
                <span className={styles.role}>{founder.role}</span>
              </h3>
              <ul className={`${styles.rows} ${styles.ventures}`}>
                {founder.main.ventures.map((venture) => (
                  <li key={venture.company}>
                    <span className={styles.ventureName}>{venture.company}</span>
                    <span className={styles.ventureWhat}>{VENTURE_LINES[venture.company]}</span>
                    <span className={styles.years}>{venture.years}</span>
                    <span className={styles.outcome}>{venture.outcome?.replace(" billion", "B")}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.column}>
              <p className={`${styles.role} ${styles.columnHead}`}>{NETWORK_TITLE}</p>
              <div className={styles.rows}>
                {network.areas.map((area) => (
                  <LogoRow key={area.label} label={area.label} logos={area.logos} inline />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <div className={styles.pair} data-split="foot">
          <Section index="05" title="Key resources">
            <ul className={styles.resources}>
              {RESOURCES.map((resource) => (
                <li key={resource.href}>
                  <a className={styles.resource} href={absolute(resource.href)}>
                    <span className={styles.resourceLabel}>{resource.label}</span>
                    <span className={styles.url}>
                      <Url href={resource.href} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section index="06" title="Contact" className={styles.contact}>
            <a className={styles.email} href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>
            <p className={styles.url}>
              <a href={absolute(CONTACT.site)}>{display(CONTACT.site)}</a>
              {" · "}
              <a href={absolute(CONTACT.engineer)}>Talk to an engineer</a>
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}
