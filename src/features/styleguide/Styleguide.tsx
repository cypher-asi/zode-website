import type { ReactElement, ReactNode } from "react";
import Image from "next/image";
import { SITE_URL } from "@/lib/site";
import {
  BRAND,
  BREAKPOINTS,
  COLOR_GROUPS,
  COMPONENTS,
  COMPOSITION,
  FORMATS,
  GOOGLE_FONTS_URL,
  HEADINGS,
  IMAGE_ASSETS,
  IMAGERY,
  LAYOUT,
  LOGO_RULES,
  MOTION,
  MOTION_RULES,
  NAMING,
  PRESS,
  PRESS_KIT_ZIP,
  RADII,
  SHADOWS,
  TYPE_FAMILIES,
  TYPE_SCALE,
  VOICE,
  type Token,
} from "./brand";
import { Contents } from "./Contents";
import { CopyButton } from "./CopyButton";
import { RESOURCES } from "./publish";
import styles from "./Styleguide.module.css";

const SECTIONS = [
  { id: "voice", title: "Voice" },
  { id: "logo", title: "Logo" },
  { id: "color", title: "Color" },
  { id: "typography", title: "Typography" },
  { id: "layout", title: "Layout and components" },
  { id: "imagery", title: "Imagery" },
  { id: "motion", title: "Motion" },
  { id: "formats", title: "Applying the system" },
  { id: "press-kit", title: "Press kit" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const AGENT_PROMPT = `Before creating anything ${BRAND.name}-branded, fetch ${SITE_URL}/styleguide.md and follow it exactly. Use the official logo files and design tokens it links (${SITE_URL}/brand/tokens.css); don't invent colors, fonts or logos.`;

const FONTS_SNIPPET = `<link rel="stylesheet" href="${GOOGLE_FONTS_URL}">
<link rel="stylesheet" href="${SITE_URL}/brand/tokens.css">`;

const LOGO_TILES = [
  { name: "Wordmark", ground: "light", file: "zode-wordmark-black", shape: "wide" },
  { name: "Wordmark, reversed", ground: "dark", file: "zode-wordmark-white", shape: "wide" },
  { name: "Monogram", ground: "light", file: "zode-monogram-black", shape: "mark" },
  { name: "Monogram, reversed", ground: "dark", file: "zode-monogram-white", shape: "mark" },
  { name: "App icon", ground: "light", file: "zode-app-icon", shape: "icon" },
] as const;

function Section({ id, children }: { id: SectionId; children: ReactNode }): ReactElement {
  const index = SECTIONS.findIndex((s) => s.id === id);
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <p className={styles.eyebrow}>{String(index + 1).padStart(2, "0")}</p>
      <h2 id={`${id}-title`} className={styles.h2}>
        {SECTIONS[index].title}
      </h2>
      {children}
    </section>
  );
}

function List({ items }: { items: readonly string[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function TokenTable({ tokens }: { tokens: readonly Token[] }): ReactElement {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">Use</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.token}>
              <td>
                <code>{t.token}</code>
              </td>
              <td>
                <code>{t.value}</code>
              </td>
              <td>{t.use || t.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Snippet({ code, label }: { code: string; label: string }): ReactElement {
  return (
    <figure className={styles.snippet}>
      <figcaption className={styles.snippetHead}>
        <span>{label}</span>
        <CopyButton text={code} />
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export function Styleguide(): ReactElement {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Brand</p>
        <h1 className={styles.h1}>Agent Styleguide</h1>
        <p className={styles.lede}>
          The {BRAND.name} brand system and press kit, for people and for the agents working with them. Everything on
          this page is also published as Markdown and design tokens, so any agent can build {BRAND.name}-branded
          documents, decks, marketing, websites and apps that look like they came from us.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/styleguide.md">
            Read as Markdown
          </a>
          <a className={styles.secondary} href={PRESS_KIT_ZIP} download>
            Download press kit
          </a>
        </div>
      </header>

      <div className={styles.body}>
        <Contents sections={SECTIONS} />

        <div className={styles.content}>
          <section className={styles.agents} aria-labelledby="agents-title">
            <h2 id="agents-title" className={styles.h3}>
              For agents
            </h2>
            <p className={styles.text}>
              Point an agent at the Markdown before it makes anything branded. Every resource is public, static, and
              allows cross-origin requests.
            </p>
            <Snippet label="Prompt" code={AGENT_PROMPT} />
            <ul className={styles.resources}>
              {RESOURCES.map((r) => (
                <li key={r.path}>
                  <a href={r.path} {...(r.path.endsWith(".zip") ? { download: true } : {})}>
                    <span className={styles.resourcePath}>{r.path}</span>
                    <span className={styles.resourceUse}>{r.use}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <Section id="voice">
            <p className={styles.lead}>{VOICE.summary}</p>
            <div className={styles.quotes}>
              {VOICE.examples.map((line) => (
                <p key={line} className={styles.quote}>
                  {line}
                </p>
              ))}
            </div>
            <div className={styles.columns}>
              <div>
                <h3 className={styles.h3}>Principles</h3>
                <List items={VOICE.principles} />
              </div>
              <div>
                <h3 className={styles.h3}>Avoid</h3>
                <List items={VOICE.avoid} />
              </div>
            </div>
            <h3 className={styles.h3}>Naming</h3>
            <List items={NAMING} />
          </Section>

          <Section id="logo">
            <ul className={styles.logos}>
              {LOGO_TILES.map((tile) => (
                <li key={tile.file} className={styles.logoTile} data-ground={tile.ground} data-shape={tile.shape}>
                  <div className={styles.logoArt}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the SVG itself is the specimen */}
                    <img src={`/brand/${tile.file}.svg`} alt={`${BRAND.name} ${tile.name.toLowerCase()}`} />
                  </div>
                  <div className={styles.logoMeta}>
                    <span>{tile.name}</span>
                    <span className={styles.downloads}>
                      <a href={`/brand/${tile.file}.svg`} download>
                        SVG
                      </a>
                      <a href={`/brand/${tile.file}.png`} download>
                        PNG
                      </a>
                    </span>
                  </div>
                </li>
              ))}
              <li className={styles.logoTile} data-ground="light" data-shape="clear">
                <div className={styles.logoArt}>
                  <span className={styles.clearSpace}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the SVG itself is the specimen */}
                    <img src="/brand/zode-wordmark-black.svg" alt="" />
                  </span>
                </div>
                <div className={styles.logoMeta}>
                  <span>Clear space: one wordmark height</span>
                </div>
              </li>
            </ul>
            <dl className={styles.rules}>
              {LOGO_RULES.marks.map((m) => (
                <div key={m.name}>
                  <dt>{m.name}</dt>
                  <dd>{m.use}</dd>
                </div>
              ))}
              <div>
                <dt>Clear space</dt>
                <dd>{LOGO_RULES.clearSpace}</dd>
              </div>
              <div>
                <dt>Minimum size</dt>
                <dd>{LOGO_RULES.minimumSize}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{LOGO_RULES.color}</dd>
              </div>
            </dl>
            <h3 className={styles.h3}>Don&rsquo;t</h3>
            <List items={LOGO_RULES.dont} />
          </Section>

          <Section id="color">
            {COLOR_GROUPS.map((group) => (
              <div key={group.id} className={styles.group}>
                <h3 className={styles.h3}>{group.title}</h3>
                {group.note ? <p className={styles.text}>{group.note}</p> : null}
                <ul className={styles.swatches}>
                  {group.tokens.map((t) => (
                    <li key={t.token} className={styles.swatch}>
                      <span className={styles.chip} style={{ background: `var(${t.token})` }} />
                      <span className={styles.swatchName}>{t.name}</span>
                      <code>{t.value}</code>
                      <code className={styles.swatchToken}>{t.token}</code>
                      <span className={styles.swatchUse}>{t.use}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          <Section id="typography">
            <ul className={styles.families}>
              {TYPE_FAMILIES.map((f) => (
                <li key={f.family} className={styles.family}>
                  <span className={styles.familySample} style={{ fontFamily: `var(${f.token})` }}>
                    Aa
                  </span>
                  <span className={styles.familyRole}>{f.role}</span>
                  <span className={styles.familyName}>{f.family}</span>
                  <span className={styles.text}>{f.weights}</span>
                  <span className={styles.text}>{f.use}</span>
                </li>
              ))}
            </ul>
            <div className={styles.specimen}>
              <p className={styles.eyebrow}>Eyebrow label</p>
              <p className={styles.specimenH1}>From order to tokens in 90 days.</p>
              <p className={styles.specimenH2}>Vertically integrated, from dirt to tokens.</p>
              <p className={styles.specimenBody}>
                Power, cooling, and networking delivered all the way to the GPU. Bring your workload and start producing
                tokens.
              </p>
            </div>
            <ul className={styles.scale}>
              {[...TYPE_SCALE].reverse().map((t) => (
                <li key={t.token}>
                  <code>
                    {t.token} · {t.value}
                  </code>
                  <span style={{ fontSize: `var(${t.token})` }}>{t.use}</span>
                </li>
              ))}
            </ul>
            <TokenTable tokens={HEADINGS} />
            <Snippet label="Fonts and tokens for the web" code={FONTS_SNIPPET} />
          </Section>

          <Section id="layout">
            <List items={COMPOSITION} />
            <h3 className={styles.h3}>Components</h3>
            <div className={styles.demo}>
              <button type="button" className={styles.primary}>
                Primary
              </button>
              <button type="button" className={styles.secondary}>
                Secondary
              </button>
              <span className={styles.caps}>Buy compute</span>
              <span className={styles.chipDemo}>64 nodes</span>
              <span className={styles.chipDemo} data-selected="">
                128 nodes
              </span>
              <label className={styles.fieldDemo}>
                <span>Email</span>
                <input className={styles.input} type="email" placeholder="you@company.com" />
              </label>
            </div>
            <dl className={styles.rules}>
              {COMPONENTS.map((c) => (
                <div key={c.name}>
                  <dt>{c.name}</dt>
                  <dd>{c.spec}</dd>
                </div>
              ))}
            </dl>
            <h3 className={styles.h3}>Radius</h3>
            <ul className={styles.boxes}>
              {RADII.map((t) => (
                <li key={t.token}>
                  <span className={styles.box} style={{ borderRadius: `var(${t.token})` }} />
                  <code>{t.token}</code>
                  <span className={styles.text}>{t.use}</span>
                </li>
              ))}
            </ul>
            <h3 className={styles.h3}>Elevation</h3>
            <ul className={styles.boxes}>
              {SHADOWS.filter((t) => t.token !== "--shadow-focus").map((t) => (
                <li key={t.token}>
                  <span className={styles.box} data-raised="" style={{ boxShadow: `var(${t.token})` }} />
                  <code>{t.token}</code>
                  <span className={styles.text}>{t.use}</span>
                </li>
              ))}
            </ul>
            <h3 className={styles.h3}>Spacing and breakpoints</h3>
            <TokenTable tokens={LAYOUT} />
            <ul className={styles.inline}>
              {BREAKPOINTS.map((b) => (
                <li key={b.width}>
                  <code>{b.width}</code> {b.use}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="imagery">
            <div className={styles.images}>
              <Image src="/images/future-home/zode-exterior.jpg" alt="A ZODE render in a calm, daylit setting" width={1024} height={540} sizes="(max-width: 700px) 100vw, 480px" />
              <Image src="/images/future-home/zode-cutaway.jpg" alt="A cutaway render of a ZODE's interior" width={1024} height={540} sizes="(max-width: 700px) 100vw, 480px" />
            </div>
            <p className={styles.text}>{IMAGERY.renders}</p>
            <p className={styles.text}>{IMAGERY.drawings}</p>
            <h3 className={styles.h3}>Avoid</h3>
            <List items={IMAGERY.avoid} />
          </Section>

          <Section id="motion">
            <List items={MOTION_RULES} />
            <TokenTable tokens={MOTION} />
          </Section>

          <Section id="formats">
            <ul className={styles.formats}>
              {FORMATS.map((f) => (
                <li key={f.id} className={styles.format}>
                  <h3 className={styles.h3}>{f.title}</h3>
                  <List items={f.rules} />
                </li>
              ))}
            </ul>
          </Section>

          <Section id="press-kit">
            <div className={styles.actions}>
              <a className={styles.primary} href={PRESS_KIT_ZIP} download>
                Download everything (.zip)
              </a>
              <a className={styles.secondary} href={`mailto:${BRAND.email}`}>
                {BRAND.email}
              </a>
            </div>
            <h3 className={styles.h3}>Boilerplate</h3>
            <Snippet label="About ZODE" code={PRESS.boilerplate} />
            <Snippet label="One line" code={PRESS.shortBoilerplate} />
            <h3 className={styles.h3}>Facts</h3>
            <dl className={styles.facts}>
              {PRESS.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <h3 className={styles.h3}>Renders</h3>
            <ul className={styles.renders}>
              {IMAGE_ASSETS.map((a) => (
                <li key={a.file}>
                  <a href={a.file} download>
                    <Image src={a.file} alt={a.name} width={320} height={a.file.includes("hero") ? 427 : 169} sizes="(max-width: 700px) 50vw, 220px" />
                    <span>{a.name}</span>
                    <span className={styles.text}>{a.note}</span>
                  </a>
                </li>
              ))}
            </ul>
            <h3 className={styles.h3}>Usage</h3>
            <p className={styles.text}>{PRESS.terms}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
