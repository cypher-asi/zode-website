import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { Logo } from "@/features/deck/slides";
import { AS_OF } from "@/features/deck/research";
import { PrincipleArt } from "@/features/home/principles/PrincipleArt";
import { PRINCIPLES } from "@/features/home/principles/principles";
import { SITE_URL } from "@/lib/site";
import { ABOUT, CONTACT, COVER, PIPELINE, RESOURCES, SOLUTION, TEAM, TRACTION } from "./profile";
import { PodDrawing, PrintButton } from "./ProfileClient";
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

function LogoRow({ label, logos }: { label: string; logos: readonly Logo[] }): ReactElement {
  return (
    <div className={styles.logoRow}>
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
 * contact. On screen the sheet sits on paper with a button to print it;
 * printed, the sheet is the page.
 */
export function CompanyProfile(): ReactElement {
  const { founder, network } = TEAM;
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <PrintButton className={styles.print} />
      </div>
      <article className={styles.sheet}>
        <header className={styles.masthead}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the wordmark SVG scales to the masthead's height */}
          <img className={styles.wordmark} src="/brand/zode-wordmark-black.svg" alt="ZODE" />
          <p className={styles.meta}>Company profile · {AS_OF}</p>
        </header>

        <Section index="01" title="What ZODE does" className={styles.what}>
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <h1 className={styles.title}>{COVER.title}</h1>
              <p className={styles.lede}>{COVER.lede}</p>
              <p className={styles.body}>{ABOUT}</p>
              <ul className={styles.facts}>
                {SOLUTION.facts.map((fact) => (
                  <li key={fact.label}>
                    <Stat value={fact.value} label={fact.label} />
                  </li>
                ))}
              </ul>
            </div>
            <figure className={styles.pod}>
              <PodDrawing />
              <figcaption className={styles.caption}>Fig. 01 — ZODE, compute pod</figcaption>
            </figure>
          </div>
          <ul className={styles.principles}>
            {PRINCIPLES.map((principle, i) => (
              <li key={principle.id} className={styles.principle}>
                <div className={styles.principleArt}>
                  <PrincipleArt id={principle.id} />
                </div>
                <h3 className={styles.principleTitle}>
                  <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
                  {principle.title}
                </h3>
                <p className={styles.small}>{principle.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <div className={styles.pair}>
          <Section index="02" title="Capacity pipeline">
            <div className={styles.stats}>
              <Stat value={String(PIPELINE.sites.length)} label="Sites ready to close" />
              <Stat value={`${PIPELINE.total} MW`} label="IT capacity across them" />
              {PIPELINE.capacity.map((stat) => (
                <Stat key={stat.label} value={stat.value} label={stat.label} />
              ))}
            </div>
            <table className={styles.sites}>
              <tbody>
                {PIPELINE.sites.map((site) => (
                  <tr key={`${site.map}-${site.mw}`}>
                    <th scope="row">{site.site}</th>
                    <td>{site.path}</td>
                    <td>{site.status}</td>
                    <td className={styles.mw}>{site.mw} MW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section index="03" title="Customers">
            <div className={styles.stats}>
              <Stat value={TRACTION.contracted.value} label={TRACTION.contracted.label} large />
              <Stat value={TRACTION.loi.value} label={TRACTION.loi.label} large />
            </div>
            <div className={styles.logoRows}>
              {TRACTION.customers.map((group) => (
                <LogoRow key={group.label} label={group.label} logos={group.logos} />
              ))}
            </div>
          </Section>
        </div>

        <Section index="04" title="Leadership">
          <div className={styles.team}>
            <div className={styles.founder}>
              <p className={styles.role}>{founder.role}</p>
              <h3 className={styles.person}>{founder.name}</h3>
              <ul className={styles.ventures}>
                {founder.main.ventures.map((venture) => (
                  <li key={venture.company}>
                    <span className={styles.ventureName}>{venture.company}</span>
                    <span className={styles.years}>{venture.years}</span>
                    <span className={styles.small}>
                      {venture.description}
                      {venture.outcome ? <strong className={styles.outcome}> {venture.outcome}</strong> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.network}>
              <p className={styles.role}>{network.title}</p>
              <div className={styles.logoRows}>
                {network.areas.map((area) => (
                  <LogoRow key={area.label} label={area.label} logos={area.logos} />
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
            <a className={styles.url} href={absolute(CONTACT.site)}>
              {display(CONTACT.site)}
            </a>
            <a className={styles.url} href={absolute(CONTACT.engineer)}>
              Talk to an engineer · {display(CONTACT.engineer)}
            </a>
          </Section>
        </div>

        <footer className={styles.fine}>
          Figures as of {AS_OF}. Letters of intent and pipeline sites are non-binding. Third-party logos are the
          trademarks of their owners; their appearance does not imply endorsement of, or any commitment to, ZODE.
        </footer>
      </article>
    </main>
  );
}
