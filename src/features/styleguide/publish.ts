import { SITE_URL } from "@/lib/site";
import {
  BRAND,
  COLOR_GROUPS,
  BREAKPOINTS,
  COMPONENTS,
  COMPOSITION,
  DISPLAY_FONT,
  FORMATS,
  GOOGLE_FONTS_URL,
  IMAGE_ASSETS,
  IMAGERY,
  LOGO_ASSETS,
  LOGO_RULES,
  MOTION_RULES,
  NAMING,
  PRESS,
  PRESS_KIT_ZIP,
  TOKEN_SECTIONS,
  TYPE_FAMILIES,
  VOICE,
  type TokenGroup,
} from "./brand";

/** The machine-readable files, as served (see the rewrites in next.config.ts). */
export const RESOURCES = [
  { path: "/styleguide.md", name: "Styleguide (Markdown)", use: "This whole guide as one Markdown file, for agents." },
  { path: "/brand/tokens.css", name: "Design tokens (CSS)", use: "Every token as CSS custom properties on :root." },
  { path: "/brand/tokens.json", name: "Design tokens (JSON)", use: "The same tokens, grouped, for build tools and non-web formats." },
  { path: PRESS_KIT_ZIP, name: "Press kit (zip)", use: "Every logo and render in one download." },
  { path: "/llms.txt", name: "llms.txt", use: "Index of these resources for crawlers and agents." },
] as const;

const url = (path: string) => `${SITE_URL}${path}`;

export function tokensCss(): string {
  const lines = [
    `/*`,
    ` * ${BRAND.name} design tokens. Source: ${url("/styleguide")}`,
    ` * Fonts: <link rel="stylesheet" href="${GOOGLE_FONTS_URL}">`,
    ` */`,
    `:root {`,
    ...TYPE_FAMILIES.map((f) => `  ${f.token}: ${f.stack};`),
  ];
  for (const section of TOKEN_SECTIONS) {
    lines.push("", `  /* ${section.title} */`);
    for (const t of section.tokens) lines.push(`  ${t.token}: ${t.value};`);
  }
  lines.push(
    "}",
    "",
    "@media (max-width: 900px) {",
    "  :root {",
    "    --edge: 24px;",
    "    --h1-size: clamp(32px, 8vw, 46px);",
    "  }",
    "}",
    "",
  );
  return lines.join("\n");
}

export function tokensJson() {
  return {
    name: BRAND.name,
    source: url("/styleguide"),
    fonts: {
      googleFontsUrl: GOOGLE_FONTS_URL,
      families: Object.fromEntries(TYPE_FAMILIES.map((f) => [f.role.toLowerCase(), { family: f.family, token: f.token, stack: f.stack, weights: f.weights, use: f.use }])),
    },
    tokens: Object.fromEntries(
      TOKEN_SECTIONS.map((section) => [
        section.id,
        Object.fromEntries(section.tokens.map((t) => [t.token.replace(/^--/, ""), { value: t.value, name: t.name, use: t.use || undefined }])),
      ]),
    ),
    breakpoints: BREAKPOINTS,
  };
}

const bullets = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

function tokenTable(section: TokenGroup, heading = `### ${section.title}`): string {
  return [
    heading,
    section.note ? `\n${section.note}\n` : "",
    "| Token | Value | Use |",
    "| --- | --- | --- |",
    ...section.tokens.map((t) => `| \`${t.token}\` | \`${t.value}\` | ${t.use || t.name} |`),
  ].join("\n");
}

const tokenTables = (ids: readonly string[]) =>
  TOKEN_SECTIONS.filter((s) => ids.includes(s.id))
    .map((s) => tokenTable(s))
    .join("\n\n");

export function styleguideMarkdown(): string {
  return `# ${BRAND.name} Agent Styleguide

> The official ${BRAND.name} brand system and press kit, written for AI agents and people building ${BRAND.name}-branded documents, decks, marketing, websites and apps. Canonical page: ${url("/styleguide")}

**${BRAND.tagline}** ${BRAND.descriptor}

## For agents

1. Read this file end to end before producing anything branded.
2. For web work, load the fonts and link the tokens, then use only \`var(--*)\` tokens:

\`\`\`html
<link rel="stylesheet" href="${GOOGLE_FONTS_URL}">
<link rel="stylesheet" href="${url("/brand/tokens.css")}">
\`\`\`

3. Use the official logo files below; never redraw the logo or set the name in a font as a stand-in.
4. Check your output against the rules in Voice, Logo and Composition.

Resources:

${RESOURCES.map((r) => `- [${r.name}](${url(r.path)}): ${r.use}`).join("\n")}

## Voice

${VOICE.summary}

${bullets(VOICE.principles)}

Reference lines:

${bullets(VOICE.examples.map((e) => `"${e}"`))}

Avoid:

${bullets(VOICE.avoid)}

### Naming

${bullets(NAMING)}

## Logo

${LOGO_RULES.marks.map((m) => `- **${m.name}.** ${m.use}`).join("\n")}

- **Clear space.** ${LOGO_RULES.clearSpace}
- **Minimum size.** ${LOGO_RULES.minimumSize}
- **Color.** ${LOGO_RULES.color}

Don't:

${bullets(LOGO_RULES.dont)}

## Color

${COLOR_GROUPS.map((g) => tokenTable(g)).join("\n\n")}

## Typography

| Role | Family | Token | Weights | Use |
| --- | --- | --- | --- | --- |
${TYPE_FAMILIES.map((f) => `| ${f.role} | ${f.family} | \`${f.token}\` | ${f.weights} | ${f.use} |`).join("\n")}

Font stacks:

${TYPE_FAMILIES.map((f) => `- ${f.role}: \`${f.stack}\``).join("\n")}

Headlines are ${DISPLAY_FONT} Light in sentence case, ending with a period. Eyebrows are Geist Mono or Inter, uppercase, 11px with 0.16em tracking.

${tokenTables(["type-scale", "headings"])}

## Composition

${bullets(COMPOSITION)}

Breakpoints: ${BREAKPOINTS.map((b) => `${b.width} (${b.use.toLowerCase()})`).join(", ")}.

${tokenTables(["layout", "radius", "shadow"])}

## Components

${COMPONENTS.map((c) => `- **${c.name}.** ${c.spec}`).join("\n")}

## Imagery

${IMAGERY.renders}

${IMAGERY.drawings}

Avoid:

${bullets(IMAGERY.avoid)}

## Motion

${bullets(MOTION_RULES)}

${tokenTables(["motion"])}

## Applying the system

${FORMATS.map((f) => `### ${f.title}\n\n${bullets(f.rules)}`).join("\n\n")}

## Press kit

Everything in one file: ${url(PRESS_KIT_ZIP)}

### Logos

${LOGO_ASSETS.map((a) => `- ${a.name} (${a.note}): ${url(a.file)}`).join("\n")}

### Renders

${IMAGE_ASSETS.map((a) => `- ${a.name} (${a.note}): ${url(a.file)}`).join("\n")}

### Boilerplate

${PRESS.boilerplate}

Short: ${PRESS.shortBoilerplate}

### Facts

${PRESS.facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}

### Usage

${PRESS.terms}

Press and brand questions: ${BRAND.email}
`;
}

export function llmsTxt(): string {
  return `# ${BRAND.name}

> ${BRAND.descriptor} ${PRESS.shortBoilerplate}

## Brand

${RESOURCES.map((r) => `- [${r.name}](${url(r.path)}): ${r.use}`).join("\n")}
- [Styleguide (web page)](${url("/styleguide")}): The same guide for people.

## Site

- [Home](${url("/")}): What a ZODE is.
- [Buy compute](${url("/buy-compute")}): Configure and price a ZODE.
- [Talk to an engineer](${url("/talk-to-an-engineer")}): Sales contact.
- [Contact](${url("/contact")}): ${BRAND.email}
`;
}
