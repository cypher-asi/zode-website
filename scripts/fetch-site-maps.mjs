/**
 * Draws the pipeline slide's site maps (src/features/deck/art/siteMaps.ts):
 * roads, rail and water around each city's centre from OpenStreetMap, by the
 * Overpass API, projected into a 200 × 200 box, clipped to it and thinned so
 * each map is a few path strings. Run by hand when a site is added or moved;
 * the output is committed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../src/features/deck/art/siteMaps.ts", import.meta.url);
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** City centres, not site addresses; `km` is the width of the square drawn around each. */
const SITES = [
  { id: "chicago", lat: 41.8818, lng: -87.6298, km: 5 },
  { id: "olds", lat: 51.7926, lng: -114.1067, km: 4 },
  { id: "calgary", lat: 51.0477, lng: -114.0719, km: 5 },
  { id: "milton", lat: 43.5183, lng: -79.8774, km: 5 },
  { id: "mississauga", lat: 43.589, lng: -79.6441, km: 5 },
];

/** The card's map cell is about 120 px square on a laptop, so a unit is about half a pixel. */
const VIEW = 200;
/** Lines run past the frame so strokes and fills don't stop short of the card's edge. */
const BLEED = 4;
/** Vertices closer than this to the line through their neighbours are dropped (viewBox units). */
const TOLERANCE = 0.6;

/** OpenStreetMap highway classes, by the weight each road is drawn at. */
const ROADS = {
  major: "motorway|trunk|primary",
  arterial: "secondary|tertiary",
  minor: "residential|unclassified",
};

function query({ lat, lng, km }) {
  const dLat = km / 2 / 110.574;
  const dLng = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((n) => n.toFixed(5)).join(",");
  return `[out:json][timeout:120];
(
  way["highway"~"^(${Object.values(ROADS).join("|")})$"]["tunnel"!~"."]["area"!~"yes"](${bbox});
  way["railway"="rail"][!"service"]["tunnel"!~"."](${bbox});
  way["waterway"~"^(river|stream|canal)$"]["tunnel"!~"."](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
);
out geom;`;
}

/** Raw responses are kept here, so redrawing doesn't refetch; delete it to pick up OpenStreetMap edits. */
const CACHE = new URL("../node_modules/.cache/site-maps/", import.meta.url);

async function overpass(site) {
  const file = new URL(`${site.id}-${site.km}km.json`, CACHE);
  const cached = await readFile(file, "utf8").catch(() => null);
  if (cached) return JSON.parse(cached);
  const elements = await fetchOverpass(site);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(elements));
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  return elements;
}

async function fetchOverpass(site) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "zode-website site maps" },
      body: new URLSearchParams({ data: query(site) }),
    });
    if (res.ok) return (await res.json()).elements;
    if (attempt === 3 || (res.status !== 429 && res.status !== 504)) throw new Error(`${site.id}: Overpass HTTP ${res.status}`);
    await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)));
  }
}

function projector({ lat, lng, km }) {
  const kx = (111.32 * Math.cos((lat * Math.PI) / 180) * VIEW) / km;
  const ky = (110.574 * VIEW) / km;
  return ({ lat: y, lon: x }) => [VIEW / 2 + (x - lng) * kx, VIEW / 2 - (y - lat) * ky];
}

const LO = -BLEED;
const HI = VIEW + BLEED;
const inside = ([x, y]) => x >= LO && x <= HI && y >= LO && y <= HI;

/** Liang–Barsky: the part of segment a–b inside the frame, or null. */
function clipSegment(a, b) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, a[0] - LO],
    [dx, HI - a[0]],
    [-dy, a[1] - LO],
    [dy, HI - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return null;
    }
  }
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

/** A polyline cut to the frame, as the runs that fall inside it. */
function clipLine(points) {
  const runs = [];
  let run = null;
  for (let i = 1; i < points.length; i++) {
    const seg = clipSegment(points[i - 1], points[i]);
    if (!seg) {
      run = null;
      continue;
    }
    if (!run) {
      run = [seg[0]];
      runs.push(run);
    }
    run.push(seg[1]);
    if (!inside(points[i])) run = null;
  }
  return runs;
}

/** Sutherland–Hodgman against the frame; fine for fills, whose edges along the frame fall in the bleed. */
function clipRing(points) {
  const edges = [
    (p) => p[0] >= LO,
    (p) => p[0] <= HI,
    (p) => p[1] >= LO,
    (p) => p[1] <= HI,
  ];
  const cross = [
    (a, b) => [LO, a[1] + ((LO - a[0]) * (b[1] - a[1])) / (b[0] - a[0])],
    (a, b) => [HI, a[1] + ((HI - a[0]) * (b[1] - a[1])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((LO - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), LO],
    (a, b) => [a[0] + ((HI - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), HI],
  ];
  let ring = points;
  edges.forEach((keep, e) => {
    const next = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length];
      const b = ring[i];
      if (keep(b)) {
        if (!keep(a)) next.push(cross[e](a, b));
        next.push(b);
      } else if (keep(a)) next.push(cross[e](a, b));
    }
    ring = next;
  });
  return ring;
}

/** Douglas–Peucker: drop vertices within TOLERANCE of the line their neighbours make. */
function simplify(points) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = points[i];
    const [bx, by] = points[j];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = 0;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (ay - points[k][1]) - (ax - points[k][0]) * (by - ay)) / len;
      if (d > far) [far, at] = [d, k];
    }
    if (far > TOLERANCE) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

/** Open lines that meet end to end joined into one, so each costs one move rather than many. */
function joinLines(lines) {
  const key = ([x, y]) => `${x},${y}`;
  const open = lines.map((l) => [...l]);
  const joined = [];
  while (open.length) {
    const line = open.pop();
    for (let grew = true; grew; ) {
      grew = false;
      const head = key(line[0]);
      const tail = key(line[line.length - 1]);
      const i = open.findIndex((l) => [head, tail].includes(key(l[0])) || [head, tail].includes(key(l[l.length - 1])));
      if (i < 0) break;
      const [l] = open.splice(i, 1);
      if (key(l[0]) === tail) line.push(...l.slice(1));
      else if (key(l[l.length - 1]) === tail) line.push(...l.reverse().slice(1));
      else if (key(l[l.length - 1]) === head) line.unshift(...l.slice(0, -1));
      else line.unshift(...l.reverse().slice(0, -1));
      grew = true;
    }
    joined.push(line);
  }
  return joined;
}

/** Whole units, each point relative to the last, so most cost a few characters. */
function toPath(points, close = false) {
  const grid = points.map(([x, y]) => [Math.round(x), Math.round(y)]).filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  if (grid.length < (close ? 3 : 2)) return "";
  const pair = ([x, y]) => `${x}${y < 0 ? "" : " "}${y}`;
  const steps = grid.slice(1).map((p, i) => pair([p[0] - grid[i][0], p[1] - grid[i][1]]));
  const rest = steps.map((s) => (s.startsWith("-") ? s : ` ${s}`)).join("");
  return `M${pair(grid[0])}l${rest.trimStart()}${close ? "z" : ""}`;
}

/** A multipolygon's member ways joined end to end into closed rings. */
function joinRings(ways) {
  const key = (p) => `${p.lat},${p.lon}`;
  const open = ways.filter((w) => w.length > 1).map((w) => [...w]);
  const rings = [];
  while (open.length) {
    const ring = open.pop();
    for (let grew = true; grew && key(ring[0]) !== key(ring[ring.length - 1]); ) {
      grew = false;
      const end = key(ring[ring.length - 1]);
      const i = open.findIndex((w) => key(w[0]) === end || key(w[w.length - 1]) === end);
      if (i >= 0) {
        const [w] = open.splice(i, 1);
        ring.push(...(key(w[0]) === end ? w : w.reverse()).slice(1));
        grew = true;
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

function draw(site, elements) {
  const project = projector(site);
  const runs = { waterways: [], minor: [], arterial: [], major: [], rail: [] };
  const water = [];
  const line = (layer, geometry) => runs[layer].push(...clipLine(geometry.map(project)));
  const area = (geometry) => {
    const ring = clipRing(geometry.map(project));
    if (ring.length > 2) water.push(toPath(simplify(ring), true));
  };

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "relation") {
      const ways = el.members.filter((m) => m.type === "way" && m.geometry).map((m) => m.geometry);
      joinRings(ways).forEach(area);
    } else if (tags.natural === "water") {
      area(el.geometry);
    } else if (tags.railway) {
      line("rail", el.geometry);
    } else if (tags.waterway) {
      line("waterways", el.geometry);
    } else {
      const tier = Object.keys(ROADS).find((road) => new RegExp(`^(${ROADS[road]})$`).test(tags.highway));
      line(tier, el.geometry);
    }
  }
  const lines = Object.entries(runs).map(([layer, list]) => [layer, joinLines(list).map((l) => toPath(simplify(l))).join("")]);
  return { water: water.join(""), ...Object.fromEntries(lines) };
}

const maps = {};
for (const site of SITES) {
  const elements = await overpass(site);
  maps[site.id] = draw(site, elements);
  const sizes = Object.entries(maps[site.id]).map(([layer, d]) => `${layer} ${(d.length / 1024).toFixed(1)}`);
  console.log(`${site.id}: ${elements.length} features; KB ${sizes.join(", ")}`);
}

const ids = SITES.map((site) => JSON.stringify(site.id)).join(" | ");
const body = Object.entries(maps)
  .map(
    ([id, layers]) =>
      `  ${id}: {\n${Object.entries(layers)
        .map(([layer, d]) => `    ${layer}: ${JSON.stringify(d)},`)
        .join("\n")}\n  },`,
  )
  .join("\n");

await writeFile(
  OUT,
  `/**
 * The pipeline slide's site maps, a ${VIEW} × ${VIEW} box around each city's
 * centre. Generated by scripts/fetch-site-maps.mjs from OpenStreetMap data,
 * © OpenStreetMap contributors (ODbL); don't edit by hand.
 */
export type SiteMapId = ${ids};

export interface SiteMapLayers {
  /** Lakes and river areas, as closed rings. */
  readonly water: string;
  /** Rivers, streams and canals, as lines. */
  readonly waterways: string;
  /** Residential streets. */
  readonly minor: string;
  /** Secondary and tertiary roads. */
  readonly arterial: string;
  /** Motorways, trunk and primary roads. */
  readonly major: string;
  readonly rail: string;
}

export const SITE_MAPS: Record<SiteMapId, SiteMapLayers> = {
${body}
};
`,
);
