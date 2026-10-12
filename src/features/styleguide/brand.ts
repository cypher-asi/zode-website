/**
 * The published ZODE brand system: one source for the /styleguide page, its
 * Markdown twin (/styleguide.md) and the token files (/brand/tokens.css,
 * /brand/tokens.json).
 *
 * Token values mirror src/app/globals.css, resolved to literals so they work
 * outside this site; scripts/check-brand-tokens.mjs fails lint if the two
 * drift. Keep this file free of imports so that script can load it.
 */

export const BRAND = {
  name: "ZODE",
  company: "ZODE Inc.",
  tagline: "Sovereign Superintelligence.",
  descriptor: "The fastest deployable AI data center.",
  email: "hello@zode.org",
  domain: "zode.org",
} as const;

export interface Token {
  /** CSS custom property, as in globals.css. */
  readonly token: string;
  readonly value: string;
  readonly name: string;
  readonly use: string;
}

export interface TokenGroup {
  readonly id: string;
  readonly title: string;
  readonly note?: string;
  readonly tokens: readonly Token[];
}

export const COLOR_GROUPS: readonly TokenGroup[] = [
  {
    id: "core",
    title: "Core",
    note: "Almost everything is ink, paper and white. A layout should read in black and white before any accent is added.",
    tokens: [
      { token: "--color-ink", value: "#0c0c0d", name: "Ink", use: "Text, primary buttons, dark sections, the logo on light grounds." },
      { token: "--color-paper", value: "#f6f6f3", name: "Paper", use: "Subtle section backgrounds, quiet panels, text on ink." },
      { token: "--color-white", value: "#ffffff", name: "White", use: "The default page and card background; the logo on dark grounds." },
      { token: "--color-black", value: "#000000", name: "Black", use: "Full-bleed photographic and footer grounds only." },
    ],
  },
  {
    id: "text",
    title: "Text",
    note: "Tertiary fails WCAG AA below 18px; keep it to large or decorative text.",
    tokens: [
      { token: "--color-text-primary", value: "#0c0c0d", name: "Primary", use: "Headlines, labels, body copy that must be read." },
      { token: "--color-text-secondary", value: "#707075", name: "Secondary", use: "Supporting body copy, captions, metadata." },
      { token: "--color-text-tertiary", value: "#8a8a8f", name: "Tertiary", use: "Large decorative text, inactive tabs." },
      { token: "--color-text-faint", value: "#b4b4b9", name: "Faint", use: "Placeholders and disabled text." },
      { token: "--color-text-inverse", value: "#f6f6f3", name: "Inverse", use: "Text on ink or black." },
      { token: "--color-text-inverse-secondary", value: "#8a8a8f", name: "Inverse secondary", use: "Supporting text on ink or black." },
    ],
  },
  {
    id: "lines",
    title: "Lines and surfaces",
    tokens: [
      { token: "--color-border", value: "#e6e6e1", name: "Border", use: "Hairlines, dividers, card edges." },
      { token: "--color-border-strong", value: "#d9d9d4", name: "Border strong", use: "Input and control outlines." },
      { token: "--color-border-hover", value: "#a5a5a0", name: "Border hover", use: "A control's outline under the pointer." },
      { token: "--color-primary-hover", value: "#2a2a2d", name: "Primary hover", use: "Ink buttons under the pointer." },
      { token: "--color-surface-tint", value: "rgba(0, 0, 0, 0.05)", name: "Surface tint", use: "Badges and quiet fills." },
      { token: "--color-surface-hover", value: "rgba(0, 0, 0, 0.06)", name: "Surface hover", use: "Rows and ghost buttons under the pointer." },
      { token: "--color-surface-active", value: "rgba(0, 0, 0, 0.08)", name: "Surface active", use: "The selected row or pressed item." },
      { token: "--color-backdrop", value: "rgba(12, 12, 13, 0.46)", name: "Backdrop", use: "Behind modals, with a 6px blur." },
      { token: "--color-focus-ring", value: "#2563eb", name: "Focus ring", use: "Keyboard focus outlines, 2px with a 2px offset. Never decorative." },
    ],
  },
  {
    id: "accent",
    title: "Accent",
    note: "Warm orange marks one thing per view: a live signal, a progress point, a highlighted part in a drawing. Never a background for text, never a button fill.",
    tokens: [
      { token: "--color-accent-soft", value: "#ffd6a0", name: "Accent soft", use: "Text selection, soft highlights." },
      { token: "--color-accent", value: "#ffa45c", name: "Accent", use: "Signals and highlights on dark grounds." },
      { token: "--color-accent-strong", value: "#f08a3c", name: "Accent strong", use: "Signals and highlights on light grounds." },
    ],
  },
  {
    id: "status",
    title: "Status",
    note: "Product UI only (forms, dashboards, notices); never in marketing.",
    tokens: [
      { token: "--color-danger", value: "#b42318", name: "Danger", use: "Errors and destructive actions." },
      { token: "--color-danger-bg", value: "#fef3f2", name: "Danger background", use: "Error notices." },
      { token: "--color-danger-border", value: "#fecdca", name: "Danger border", use: "Outline of a danger zone." },
      { token: "--color-success", value: "#067647", name: "Success", use: "Confirmations, healthy states." },
      { token: "--color-success-bg", value: "#ecfdf3", name: "Success background", use: "Success notices." },
      { token: "--color-warning", value: "#93370d", name: "Warning", use: "Cautions." },
      { token: "--color-warning-bg", value: "#fffaeb", name: "Warning background", use: "Caution notices." },
      { token: "--color-info", value: "#175cd3", name: "Info", use: "Neutral information tags." },
      { token: "--color-info-bg", value: "#eff8ff", name: "Info background", use: "Info tags." },
      { token: "--color-violet", value: "#5925dc", name: "Violet", use: "A second category tag beside info." },
      { token: "--color-violet-bg", value: "#f4f3ff", name: "Violet background", use: "Violet tags." },
    ],
  },
];

export interface TypeFamily {
  readonly role: string;
  readonly family: string;
  readonly token: string;
  readonly stack: string;
  readonly weights: string;
  readonly use: string;
}

export const TYPE_FAMILIES: readonly TypeFamily[] = [
  {
    role: "Display",
    family: "Newsreader",
    token: "--font-serif",
    stack: '"Newsreader", Georgia, "Times New Roman", serif',
    weights: "300 (Light) for every headline; 400 only below 20px",
    use: "Headlines and section titles. Sentence case, tight tracking, never bold.",
  },
  {
    role: "Text",
    family: "Inter",
    token: "--font-sans",
    stack: '"Inter", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    weights: "400 body, 500 labels and buttons, 600 small product headings",
    use: "Body copy, UI, buttons, captions.",
  },
  {
    role: "Mono",
    family: "Geist Mono",
    token: "--font-mono",
    stack: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    weights: "400, 500",
    use: "Eyebrows, figure labels, specs and figures, terminal-style menus, code.",
  },
];

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap";

export const TYPE_SCALE: readonly Token[] = [
  { token: "--text-2xs", value: "11px", name: "2xs", use: "Eyebrows, figure labels, fine print." },
  { token: "--text-xs", value: "12px", name: "xs", use: "Captions, uppercase nav and bars, form labels." },
  { token: "--text-sm", value: "13px", name: "sm", use: "Buttons, dense UI, secondary rows." },
  { token: "--text-base", value: "14px", name: "base", use: "UI body, inputs, menus." },
  { token: "--text-md", value: "16px", name: "md", use: "Reading body copy and ledes." },
  { token: "--text-lg", value: "20px", name: "lg", use: "Small headings, card titles." },
  { token: "--text-xl", value: "24px", name: "xl", use: "Figures and prices." },
  { token: "--text-2xl", value: "28px", name: "2xl", use: "Large figures, panel totals." },
];

export const HEADINGS: readonly Token[] = [
  { token: "--h1-size", value: "clamp(34px, 3.6vw, 56px)", name: "H1 size", use: "A page's lead headline; clamp(32px, 8vw, 46px) below 900px." },
  { token: "--h1-leading", value: "1.06", name: "H1 leading", use: "" },
  { token: "--h1-tracking", value: "-0.025em", name: "H1 tracking", use: "" },
  { token: "--h2-size", value: "clamp(29px, 2.55vw, 40px)", name: "H2 size", use: "Every section title." },
  { token: "--h2-leading", value: "1.1", name: "H2 leading", use: "" },
  { token: "--h2-tracking", value: "-0.02em", name: "H2 tracking", use: "" },
  { token: "--eyebrow-size", value: "11px", name: "Eyebrow size", use: "Uppercase label above a heading." },
  { token: "--eyebrow-tracking", value: "0.16em", name: "Eyebrow tracking", use: "" },
  { token: "--caps-size", value: "12px", name: "Caps size", use: "Uppercase nav, buttons in bars, tags." },
  { token: "--caps-tracking", value: "0.08em", name: "Caps tracking", use: "" },
];

export const RADII: readonly Token[] = [
  { token: "--radius-control", value: "3px", name: "Control", use: "Buttons, inputs, checkboxes, menu items." },
  { token: "--radius-inset", value: "6px", name: "Inset", use: "Boxes nested inside a card: choice tiles, readouts." },
  { token: "--radius-card", value: "12px", name: "Card", use: "Cards, popovers, dialogs." },
  { token: "--radius-panel", value: "16px", name: "Panel", use: "Floating panels and bottom sheets." },
  { token: "--radius-pill", value: "999px", name: "Pill", use: "Chips, segmented controls, badges." },
];

export const SHADOWS: readonly Token[] = [
  { token: "--shadow-sm", value: "0 1px 2px rgba(0, 0, 0, 0.04)", name: "Small", use: "A resting tile that needs separating from white." },
  { token: "--shadow-md", value: "0 12px 32px -12px rgba(0, 0, 0, 0.35)", name: "Medium", use: "Popovers, menus, floating bars." },
  { token: "--shadow-card", value: "0 24px 60px -32px rgba(0, 0, 0, 0.3)", name: "Card", use: "A card resting on the page." },
  { token: "--shadow-lg", value: "0 24px 60px -24px rgba(0, 0, 0, 0.5)", name: "Large", use: "A panel over a backdrop." },
  { token: "--shadow-modal", value: "0 40px 100px -30px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.06)", name: "Modal", use: "Route modals." },
  { token: "--shadow-focus", value: "0 0 0 3px rgba(12, 12, 13, 0.08)", name: "Focus halo", use: "Around a focused text field, with an ink border." },
];

export const MOTION: readonly Token[] = [
  { token: "--duration-fast", value: "120ms", name: "Fast", use: "Color and opacity on hover." },
  { token: "--duration-base", value: "160ms", name: "Base", use: "Most state changes." },
  { token: "--duration-slow", value: "280ms", name: "Slow", use: "Fills, reveals, backdrops." },
  { token: "--ease-out", value: "cubic-bezier(0.2, 0.8, 0.2, 1)", name: "Ease out", use: "Things arriving: panels, sheets, pop-ins." },
  { token: "--ease-in-out", value: "cubic-bezier(0.65, 0, 0.35, 1)", name: "Ease in-out", use: "Things moving between two places." },
];

export const LAYOUT: readonly Token[] = [
  { token: "--edge", value: "clamp(32px, 6vw, 96px)", name: "Edge", use: "Horizontal page inset that headlines, header and footer align to; 24px below 900px." },
  { token: "--frame-inset", value: "clamp(8px, 1vw, 16px)", name: "Frame inset", use: "How far the frame rails sit in from the viewport." },
];

export const BREAKPOINTS = [
  { width: "480px", use: "Small phones" },
  { width: "700px", use: "Phones; modals become bottom sheets" },
  { width: "900px", use: "Tablets and below; single-column layouts" },
  { width: "1200px", use: "Small laptops" },
] as const;

/** Every token group, in publishing order. */
export const TOKEN_SECTIONS: readonly TokenGroup[] = [
  ...COLOR_GROUPS,
  { id: "type-scale", title: "Type scale", tokens: TYPE_SCALE },
  { id: "headings", title: "Headings and labels", tokens: HEADINGS },
  { id: "radius", title: "Radius", tokens: RADII },
  { id: "shadow", title: "Elevation", tokens: SHADOWS },
  { id: "motion", title: "Durations and easing", tokens: MOTION },
  { id: "layout", title: "Layout", tokens: LAYOUT },
];

export const VOICE = {
  summary:
    "ZODE sounds like an engineer who is certain: short, declarative, concrete. It states what the product does and lets the numbers carry the weight.",
  principles: [
    "Declare, don't sell. Headlines are short statements that end with a period: \"Reclaim your sovereignty.\"",
    "Concrete over superlative. Use the real figure (90 days, N+1, 1 GW) instead of an adjective.",
    "One idea per sentence, one point per paragraph. Body copy rarely runs past three sentences.",
    "Name the physical thing: power, cooling, networking, land. ZODE is infrastructure, not magic.",
    "Calm confidence. No exclamation marks, no emoji, no rhetorical questions.",
  ],
  examples: [
    "Sovereign Superintelligence.",
    "The fastest deployable AI data center.",
    "From order to tokens in 90 days.",
    "Vertically integrated, from dirt to tokens.",
    "Built by robots in North America.",
  ],
  avoid: [
    "Hype words: revolutionary, game-changing, cutting-edge, next-gen, unleash, supercharge.",
    "Vague AI imagery in words: \"AI brain\", \"the future is here\".",
    "Title Case Headlines; use sentence case.",
    "Exclamation marks, emoji, and ALL-CAPS sentences (caps are for short labels only).",
  ],
} as const;

export const NAMING = [
  "Always \"ZODE\" in capitals. Never \"Zode\" or \"zode\", except in the domain zode.org.",
  "A single unit is \"a ZODE\"; several are \"ZODEs\" (no apostrophe).",
  "The modules are \"ZODE Pods\": the Compute Pod, Electrical Pod and Cooling Pod.",
  "The company is \"ZODE Inc.\" in legal and press contexts, otherwise just \"ZODE\".",
  "Never translate, abbreviate or space the name (not \"Z.O.D.E.\" or \"Zo-de\").",
] as const;

export const LOGO_RULES = {
  marks: [
    { name: "Wordmark", use: "The primary logo. Use it wherever there is room." },
    { name: "Monogram", use: "The Z on its own, for avatars, favicons and tight spaces where the wordmark would fall below its minimum size." },
    { name: "App icon", use: "The monogram in white on an ink square, for app stores, social avatars and favicons." },
  ],
  clearSpace: "Keep clear space on every side equal to the wordmark's height (the cap height of the Z).",
  minimumSize: "Wordmark at least 72px wide on screen or 20mm in print; monogram at least 16px.",
  color: "Ink (#0c0c0d) on white or paper, or white on ink, black or a calm, dark area of a photograph. Nothing else.",
  dont: [
    "Don't recolor it, including in the accent orange or a gradient.",
    "Don't stretch, skew, rotate, outline or add effects such as shadows and glows.",
    "Don't retype the name in a font to stand in for the wordmark.",
    "Don't place it on busy imagery or mid-tone backgrounds where contrast drops.",
    "Don't lock it up with other logos without approval from ZODE.",
  ],
} as const;

export const COMPOSITION = [
  "Whitespace is the material. Give headlines room and let one idea fill a view.",
  "Headlines align left to the page edge (--edge); center only a closing call to action.",
  "A thin frame of hairline rails with small square corner ticks (--frame-inset in from the edges) holds full-screen sections.",
  "Alternate grounds by section: white, then paper, then ink for a dark chapter. Never more than one dark section in a row.",
  "Above every section title, a mono uppercase eyebrow. Under every technical drawing, a mono label such as \"FIG. 01\".",
  "Menus can read like a terminal: mono text, a \">\" before the active row and a block cursor after it.",
] as const;

export const COMPONENTS = [
  { name: "Primary button", spec: "Ink fill, white Inter 13px/500 text, 40px tall (32 small, 48 large), 3px radius. One per view." },
  { name: "Secondary button", spec: "White fill, 1px border-strong outline, ink text; the outline darkens on hover." },
  { name: "Uppercase action", spec: "Inter uppercase label (12px, 0.08em tracking) in a 1px ink outline with a 3px radius; the site header's \"BUY COMPUTE\"." },
  { name: "Text field", spec: "40px tall, 1px border-strong, 3px radius, white; on focus an ink border and the focus halo. Labels sit above, 12px/500." },
  { name: "Card", spec: "White, 1px border, 12px radius; resting cards use the card shadow, never more." },
  { name: "Chip", spec: "28px pill, 1px border-strong, 12px text; selected chips fill with ink." },
] as const;

export const IMAGERY = {
  renders:
    "Product renders show a ZODE as a calm architectural object: soft daylight, a pale blue-gray or neutral ground, glass and black steel, a warm interior glow. Real settings (a city plaza, a coast, a desert, snow) prove it goes anywhere.",
  drawings:
    "Technical drawings are isometric line art in ink on white or paper, with gray face shading and the accent reserved for the one part being explained. Label them in mono.",
  avoid: [
    "Stock photos of server aisles, people pointing at screens, or handshakes.",
    "Neon, cyberpunk glows, glowing blue brains, circuit-board textures, floating code.",
    "Heavy filters, dramatic lens flares, or saturated color grades.",
  ],
} as const;

export const MOTION_RULES = [
  "Motion explains; it never decorates. Prefer opacity and short translations.",
  "Text can type on, line by line, like a terminal.",
  "Keep UI transitions within the duration tokens; slow, scroll-driven choreography is for hero storytelling only.",
  "Always honor prefers-reduced-motion by removing movement, not just shortening it.",
] as const;

export interface Format {
  readonly id: string;
  readonly title: string;
  readonly rules: readonly string[];
}

export const FORMATS: readonly Format[] = [
  {
    id: "web",
    title: "Websites and apps",
    rules: [
      "Load the fonts (Google Fonts URL below) and link /brand/tokens.css, then build with the var(--*) tokens only; no new hex values.",
      "White page, paper for quiet sections, ink for a dark chapter. Content max width around 1200px, inset by --edge.",
      "H1 once per page in Newsreader Light; H2 for each section; Inter for everything else.",
      "Every interactive element gets a visible :focus-visible ring in --color-focus-ring.",
      "Respect the breakpoints: 480, 700, 900, 1200.",
    ],
  },
  {
    id: "documents",
    title: "Documents and PDFs",
    rules: [
      "A4 or US Letter with generous margins (20-25mm). White page, ink text.",
      "Title in Newsreader Light at 32-40pt; section heads in Newsreader Light at 18-22pt; body in Inter at 10-11pt with 1.5 line spacing, secondary gray for supporting text.",
      "Mono uppercase labels (Geist Mono 7-8pt, 0.16em tracking) above sections and in headers and footers, with the page number.",
      "Wordmark top-left on the cover, small in the running header after that.",
      "Tables: hairline rules in --color-border, no fills except paper for the header row, tabular figures.",
    ],
  },
  {
    id: "slides",
    title: "Slides",
    rules: [
      "16:9. White or ink backgrounds, paper for a quiet divider. One message per slide.",
      "Headline in Newsreader Light, large and left-aligned, ending with a period; a mono eyebrow above it.",
      "One render, drawing or figure per slide, given room; numbers set large in Inter with a mono label.",
      "Wordmark small in a corner; slide number in mono in the opposite corner.",
    ],
  },
  {
    id: "social",
    title: "Social and marketing",
    rules: [
      "One render or drawing, one short declarative line in Newsreader Light, the wordmark. Nothing else.",
      "Use the app icon as the avatar; never the wordmark squeezed into a circle.",
      "Accent orange appears at most once, as a signal, not as a fill.",
    ],
  },
  {
    id: "email",
    title: "Email",
    rules: [
      "Mail clients don't load web fonts: use system stacks (-apple-system, Segoe UI, Helvetica, Arial) and a monospace stack for labels.",
      "Paper page, white card, ink text, #3a3a3e for long body copy, the same hairline borders.",
      "One ink button per email.",
    ],
  },
];

export interface PressAsset {
  readonly name: string;
  readonly file: string;
  readonly note: string;
}

export const LOGO_ASSETS: readonly PressAsset[] = [
  { name: "Wordmark, ink", file: "/brand/zode-wordmark-black.svg", note: "SVG, for light grounds" },
  { name: "Wordmark, ink", file: "/brand/zode-wordmark-black.png", note: "PNG, 2400px wide" },
  { name: "Wordmark, white", file: "/brand/zode-wordmark-white.svg", note: "SVG, for dark grounds" },
  { name: "Wordmark, white", file: "/brand/zode-wordmark-white.png", note: "PNG, 2400px wide" },
  { name: "Monogram, ink", file: "/brand/zode-monogram-black.svg", note: "SVG" },
  { name: "Monogram, ink", file: "/brand/zode-monogram-black.png", note: "PNG, 1024px wide" },
  { name: "Monogram, white", file: "/brand/zode-monogram-white.svg", note: "SVG" },
  { name: "Monogram, white", file: "/brand/zode-monogram-white.png", note: "PNG, 1024px wide" },
  { name: "App icon", file: "/brand/zode-app-icon.svg", note: "SVG, square" },
  { name: "App icon", file: "/brand/zode-app-icon.png", note: "PNG, 1024px square" },
];

export const IMAGE_ASSETS: readonly PressAsset[] = [
  { name: "ZODE, front", file: "/images/future-home/zode-hero.jpg", note: "Render, 768 x 1024" },
  { name: "ZODE, cutaway", file: "/images/future-home/zode-cutaway.jpg", note: "Render, 1024 x 540" },
  { name: "ZODE, exterior", file: "/images/future-home/zode-exterior.jpg", note: "Render, 1024 x 540" },
  { name: "ZODE, compute hall", file: "/images/future-home/zode-hall.jpg", note: "Render, 1024 x 540" },
  { name: "ZODE, overview", file: "/images/future-home/zode-overview.jpg", note: "Render, 1024 x 540" },
  { name: "ZODE, entrance", file: "/images/future-home/zode-entrance.jpg", note: "Render, 1024 x 540" },
  { name: "ZODE, interior", file: "/images/future-home/zode-interior.jpg", note: "Render, 1024 x 540" },
];

export const PRESS_KIT_ZIP = "/brand/zode-press-kit.zip";

export const PRESS = {
  boilerplate:
    "ZODE builds factory-made AI data centers that ship complete and come online in 90 days from order, anywhere in the world. Each ZODE is built to Tier III standards with N+1 redundancy on NVIDIA reference architecture, and the stack is vertically integrated from land and power to compute, routing and network, so customers own sovereign AI capacity instead of renting it. ZODEs are built by robots in North America.",
  shortBoilerplate: "ZODE builds the fastest deployable AI data centers: factory-made, sovereign, and online in 90 days.",
  facts: [
    { label: "Order to production", value: "90 days" },
    { label: "Standard", value: "Tier III, N+1 power and cooling" },
    { label: "Architecture", value: "NVIDIA reference" },
    { label: "Active build-out", value: "1 GW by 2027, 10 GW by 2028" },
    { label: "Built in", value: "North America" },
  ],
  terms:
    "You may use these logos and images to refer to ZODE in editorial coverage, partner listings and integrations, unaltered and following the logo rules above. Don't use them to imply endorsement or partnership, or in your own product branding. Higher-resolution renders are available on request.",
} as const;
