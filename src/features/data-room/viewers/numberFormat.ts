/**
 * Excel number formats, enough of them to show a workbook's numbers the way
 * Excel does: sections (positive;negative;zero), thousands separators and
 * scaling commas, percentages, scientific notation, dates and times, quoted
 * and escaped literals, and currency tags. Colours, conditions and fill
 * characters are dropped; fractions fall back to General.
 */

const BUILTIN: Record<number, string> = {
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "m/d/yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yyyy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;(#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;(#,##0.00)",
  41: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
  42: '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)',
  43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
  44: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mm:ss.0",
  48: "##0.0E+0",
  49: "@",
};

/** The format code of one of Excel's built-in formats; anything unknown is General. */
export function builtinFormat(id: number): string {
  return BUILTIN[id] ?? "General";
}

type Token =
  | { t: "lit"; v: string }
  | { t: "ph"; v: string }
  | { t: "dot" }
  | { t: "comma" }
  | { t: "pct" }
  | { t: "exp"; plus: boolean }
  | { t: "date"; v: string }
  | { t: "general" }
  | { t: "text" };

interface NumberSection {
  kind: "number";
  prefix: string;
  suffix: string;
  intMin: number;
  group: boolean;
  decMin: number;
  decMax: number;
  scale: number;
  percent: number;
  /** Minimum exponent digits, or -1 when not scientific. */
  exp: number;
  expPlus: boolean;
}

type Section =
  | NumberSection
  | { kind: "date"; tokens: Token[]; ampm: boolean }
  | { kind: "general"; prefix: string; suffix: string }
  | { kind: "literal"; text: string };

export interface NumberFormat {
  sections: Section[];
  isDate: boolean;
}

function splitSections(code: string): string[] {
  const sections: string[] = [];
  let start = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "\\") i++;
    else if (c === '"') i = code.indexOf('"', i + 1) === -1 ? code.length : code.indexOf('"', i + 1);
    else if (c === "[") i = code.indexOf("]", i + 1) === -1 ? code.length : code.indexOf("]", i + 1);
    else if (c === ";") {
      sections.push(code.slice(start, i));
      start = i + 1;
    }
  }
  sections.push(code.slice(start));
  return sections;
}

function tokenize(section: string): Token[] {
  const tokens: Token[] = [];
  const lit = (v: string) => {
    const last = tokens[tokens.length - 1];
    if (last?.t === "lit") last.v += v;
    else tokens.push({ t: "lit", v });
  };
  for (let i = 0; i < section.length; i++) {
    const c = section[i];
    const lower = c.toLowerCase();
    if (c === '"') {
      const end = section.indexOf('"', i + 1);
      lit(section.slice(i + 1, end === -1 ? undefined : end));
      i = end === -1 ? section.length : end;
    } else if (c === "\\") {
      if (i + 1 < section.length) lit(section[++i]);
    } else if (c === "_" || c === "*") {
      i++;
    } else if (c === "[") {
      const end = section.indexOf("]", i + 1);
      const inner = section.slice(i + 1, end === -1 ? undefined : end);
      i = end === -1 ? section.length : end;
      if (/^(h+|m+|s+)$/i.test(inner)) tokens.push({ t: "date", v: `[${inner[0].toLowerCase()}]` });
      else if (inner.startsWith("$")) lit(inner.slice(1).split("-")[0]);
    } else if (c === "0" || c === "#" || c === "?") {
      tokens.push({ t: "ph", v: c });
    } else if (c === ".") {
      tokens.push({ t: "dot" });
    } else if (c === ",") {
      tokens.push({ t: "comma" });
    } else if (c === "%") {
      tokens.push({ t: "pct" });
    } else if (lower === "e" && (section[i + 1] === "+" || section[i + 1] === "-")) {
      tokens.push({ t: "exp", plus: section[i + 1] === "+" });
      i++;
    } else if (section.slice(i, i + 7).toLowerCase() === "general") {
      tokens.push({ t: "general" });
      i += 6;
    } else if (section.slice(i, i + 5).toUpperCase() === "AM/PM") {
      tokens.push({ t: "date", v: "ampm" });
      i += 4;
    } else if (section.slice(i, i + 3).toUpperCase() === "A/P") {
      tokens.push({ t: "date", v: "ap" });
      i += 2;
    } else if ("ymdhs".includes(lower)) {
      let j = i;
      while (j + 1 < section.length && section[j + 1].toLowerCase() === lower) j++;
      tokens.push({ t: "date", v: lower.repeat(j - i + 1) });
      i = j;
    } else if (c === "@") {
      tokens.push({ t: "text" });
    } else {
      lit(c);
    }
  }
  return tokens;
}

function literalText(tokens: Token[]): string {
  let text = "";
  for (const token of tokens) {
    if (token.t === "lit") text += token.v;
    else if (token.t === "dot") text += ".";
    else if (token.t === "comma") text += ",";
    else if (token.t === "pct") text += "%";
  }
  return text;
}

function compileSection(code: string): Section {
  const tokens = tokenize(code);
  if (tokens.some((token) => token.t === "date")) {
    return { kind: "date", tokens, ampm: tokens.some((token) => token.t === "date" && (token.v === "ampm" || token.v === "ap")) };
  }
  const general = tokens.findIndex((token) => token.t === "general");
  const fraction = tokens.some((token) => token.t === "lit" && token.v.includes("/"));
  if (general !== -1 || (fraction && tokens.some((token) => token.t === "ph"))) {
    const at = general === -1 ? tokens.findIndex((token) => token.t === "ph") : general;
    return { kind: "general", prefix: literalText(tokens.slice(0, at)), suffix: "" };
  }
  if (!tokens.some((token) => token.t === "ph")) return { kind: "literal", text: literalText(tokens) };

  const section: NumberSection = {
    kind: "number",
    prefix: "",
    suffix: "",
    intMin: 0,
    group: false,
    decMin: 0,
    decMax: 0,
    scale: 0,
    percent: 0,
    exp: -1,
    expPlus: false,
  };
  let part: "int" | "dec" | "exp" = "int";
  let seenDigit = false;
  let commas = 0;
  for (const token of tokens) {
    switch (token.t) {
      case "ph":
        seenDigit = true;
        if (part === "int") {
          if (commas > 0) section.group = true;
          commas = 0;
          if (token.v === "0") section.intMin++;
        } else if (part === "dec") {
          section.decMax++;
          if (token.v !== "#") section.decMin = section.decMax;
        } else {
          section.exp++;
        }
        break;
      case "dot":
        if (part === "int") {
          section.scale += commas;
          commas = 0;
          part = "dec";
        } else if (seenDigit) section.suffix += ".";
        else section.prefix += ".";
        break;
      case "comma":
        if (seenDigit && part !== "exp") commas++;
        else if (seenDigit) section.suffix += ",";
        else section.prefix += ",";
        break;
      case "pct":
        section.percent++;
        if (seenDigit) section.suffix += "%";
        else section.prefix += "%";
        break;
      case "exp":
        part = "exp";
        section.exp = 0;
        section.expPlus = token.plus;
        break;
      case "lit":
        if (seenDigit) section.suffix += token.v;
        else section.prefix += token.v;
        break;
      default:
        break;
    }
  }
  section.scale += commas;
  return section;
}

/** Compiles a format code once, for every cell that uses it. */
export function compileFormat(code: string): NumberFormat {
  const sections = splitSections(code).slice(0, 4).map(compileSection);
  return { sections, isDate: sections[0]?.kind === "date" };
}

/** Rounds half away from zero at `digits` decimals in decimal, not binary, so 1.005 rounds to 1.01. */
function toFixed(value: number, digits: number): string {
  if (value >= 1e21) return value.toFixed(digits);
  const rounded = Number(`${Math.round(Number(`${value}e${digits}`))}e-${digits}`);
  return (Number.isFinite(rounded) ? rounded : value).toFixed(digits);
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function renderNumber(value: number, section: NumberSection): string {
  const v = (value * 100 ** section.percent) / 1000 ** section.scale;
  if (section.exp >= 0) {
    const exponent = v === 0 ? 0 : Math.floor(Math.log10(v));
    let mantissa = toFixed(v / 10 ** exponent, section.decMax);
    let e = exponent;
    if (Number(mantissa) >= 10) {
      e++;
      mantissa = toFixed(v / 10 ** e, section.decMax);
    }
    const digits = String(Math.abs(e)).padStart(Math.max(1, section.exp), "0");
    return `${section.prefix}${mantissa}E${e < 0 ? "-" : section.expPlus ? "+" : ""}${digits}${section.suffix}`;
  }
  const fixed = toFixed(v, section.decMax);
  let [int, dec = ""] = fixed.split(".");
  let end = dec.length;
  while (end > section.decMin && dec[end - 1] === "0") end--;
  dec = dec.slice(0, end);
  if (int === "0" && section.intMin === 0) int = "";
  int = int.padStart(section.intMin, "0");
  if (section.group) int = group(int);
  const number = section.decMax > 0 ? `${int}.${dec}` : int;
  return `${section.prefix}${number}${section.suffix}`;
}

/** Excel's General format: integers as-is, otherwise about ten significant digits. */
export function formatGeneral(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e11) return String(value);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-5)) {
    return value
      .toExponential(5)
      .replace(/\.?0+e/, "e")
      .replace(/e([+-])(\d)$/, "e$10$2")
      .toUpperCase();
  }
  return String(Number(value.toPrecision(10)));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function renderDate(serial: number, section: { tokens: Token[]; ampm: boolean }, date1904: boolean): string {
  if (serial < 0) return formatGeneral(serial);
  const totalSeconds = Math.round(serial * 86_400);
  const days = Math.floor(totalSeconds / 86_400);
  const seconds = totalSeconds - days * 86_400;
  // Excel's 1900 calendar counts a 29 February 1900 that never was, so days after it are one off.
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : days < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + days * DAY_MS);
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;

  const { tokens } = section;
  const dateTokens = tokens.flatMap((token, i) => (token.t === "date" ? [i] : []));
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.t === "lit") out += token.v;
    else if (token.t === "dot") out += ".";
    else if (token.t === "comma") out += ",";
    else if (token.t === "ph") out += "0";
    else if (token.t === "pct") out += "%";
    if (token.t !== "date") continue;
    const v = token.v;
    const at = dateTokens.indexOf(i);
    const prev = at > 0 ? (tokens[dateTokens[at - 1]] as { v: string }).v : "";
    const next = at < dateTokens.length - 1 ? (tokens[dateTokens[at + 1]] as { v: string }).v : "";
    const minutes = v.length <= 2 && v[0] === "m" && (prev[0] === "h" || prev === "[h]" || next[0] === "s");
    if (v[0] === "y") out += v.length <= 2 ? pad(date.getUTCFullYear() % 100) : String(date.getUTCFullYear());
    else if (minutes) out += v.length === 2 ? pad(minute) : String(minute);
    else if (v === "m") out += String(date.getUTCMonth() + 1);
    else if (v === "mm") out += pad(date.getUTCMonth() + 1);
    else if (v === "mmm") out += MONTHS[date.getUTCMonth()].slice(0, 3);
    else if (v === "mmmmm") out += MONTHS[date.getUTCMonth()][0];
    else if (v[0] === "m") out += MONTHS[date.getUTCMonth()];
    else if (v === "d") out += String(date.getUTCDate());
    else if (v === "dd") out += pad(date.getUTCDate());
    else if (v === "ddd") out += DAYS[date.getUTCDay()].slice(0, 3);
    else if (v[0] === "d") out += DAYS[date.getUTCDay()];
    else if (v[0] === "h") {
      const h = section.ampm ? hour % 12 || 12 : hour;
      out += v.length >= 2 ? pad(h) : String(h);
    } else if (v[0] === "s") out += v.length >= 2 ? pad(second) : String(second);
    else if (v === "[h]") out += String(days * 24 + hour);
    else if (v === "[m]") out += String((days * 24 + hour) * 60 + minute);
    else if (v === "[s]") out += String(Math.round(serial * 86_400));
    else if (v === "ampm") out += hour < 12 ? "AM" : "PM";
    else if (v === "ap") out += hour < 12 ? "A" : "P";
  }
  return out;
}

/** A number as Excel would display it in the given format. */
export function formatNumber(value: number, format: NumberFormat, date1904 = false): string {
  const { sections } = format;
  let section = sections[0];
  let v = value;
  let sign = "";
  if (value < 0 && sections.length >= 2) {
    section = sections[1];
    v = -value;
  } else if (value === 0 && sections.length >= 3) {
    section = sections[2];
  } else if (value < 0) {
    v = -value;
    sign = "-";
  }
  let text: string;
  switch (section.kind) {
    case "literal":
      return section.text;
    case "date":
      return renderDate(value, section, date1904);
    case "general":
      text = `${section.prefix}${formatGeneral(v)}${section.suffix}`;
      break;
    case "number":
      text = renderNumber(v, section);
      break;
  }
  return sign && /[1-9]/.test(text) ? sign + text : text;
}
