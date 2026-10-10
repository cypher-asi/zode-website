import "server-only";

import { geoConicConformal, geoGraticule, geoPath, type GeoStream } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-50m.json";
import { SITES, type PlacedSite } from "./sites";

/**
 * Line-art North America for the network map, projected once per server
 * instance into a fixed viewBox. Paths are clipped to the frame and thinned
 * so the 50m Natural Earth coastline costs ~70 KB of markup rather than several
 * hundred.
 */
export const VIEW = { w: 1200, h: 900 } as const;

/** Country ids (ISO 3166 numeric) whose borders are drawn: USA, Canada, Mexico. */
const FOCUS = new Set(["840", "124", "484"]);

/** Drop projected vertices closer than this to the last kept one (viewBox units). */
const MIN_STEP = 1.5;

/** Islands smaller than this (square viewBox units) are left out. */
const MIN_AREA = 6;

/** On top of a spanning tree, each live site is linked to this many of its nearest live neighbours. */
const LINKS_PER_SITE = 2;

const topo = atlas as unknown as Topology<{ land: GeometryCollection; countries: GeometryCollection }>;

/** Points the frame is fitted around: all of mainland Alaska, the lower 48, southern Quebec and Hudson Bay. */
const FRAME: GeoJSON.MultiPoint = {
  type: "MultiPoint",
  coordinates: [
    [-168, 66],
    [-156, 71.3],
    [-141, 69.7],
    [-163, 54.8],
    [-125, 49],
    [-117, 32],
    [-97, 25.5],
    [-80.5, 25],
    [-64, 45],
    [-70, 52],
    [-95, 63],
  ],
};

/** Extremities of the lower 48, whose bounds are centred horizontally in the view. */
const CENTRE: GeoJSON.MultiPoint = {
  type: "MultiPoint",
  coordinates: [
    [-124.7, 48.4],
    [-124.4, 40.4],
    [-117.1, 32.5],
    [-97.1, 25.9],
    [-80.1, 25.2],
    [-67, 44.8],
    [-95.2, 49.4],
  ],
};

const projection = geoConicConformal()
  .rotate([105, 0])
  .parallels([35, 65])
  .fitExtent(
    [
      [30, 30],
      [VIEW.w - 30, VIEW.h - 30],
    ],
    FRAME,
  )
  .clipExtent([
    [-10, -10],
    [VIEW.w + 10, VIEW.h + 10],
  ]);

function centreHorizontally(points: GeoJSON.MultiPoint): void {
  const [[x0], [x1]] = geoPath(projection).bounds(points);
  const [tx, ty] = projection.translate();
  projection.translate([tx + VIEW.w / 2 - (x0 + x1) / 2, ty]);
}

centreHorizontally(CENTRE);

function thin(sink: GeoStream): GeoStream {
  let lastX = 0;
  let lastY = 0;
  let fresh = true;
  let held: [number, number] | null = null;
  return {
    point(x, y) {
      if (fresh || Math.hypot(x - lastX, y - lastY) >= MIN_STEP) {
        sink.point(x, y);
        lastX = x;
        lastY = y;
        fresh = false;
        held = null;
      } else {
        held = [x, y];
      }
    },
    lineStart() {
      fresh = true;
      held = null;
      sink.lineStart();
    },
    lineEnd() {
      if (held) sink.point(held[0], held[1]);
      sink.lineEnd();
    },
    polygonStart: () => sink.polygonStart(),
    polygonEnd: () => sink.polygonEnd(),
    sphere: () => sink.sphere?.(),
  };
}

const draw = geoPath({ stream: (out) => projection.stream(thin(out)) }).digits(0);
const measure = geoPath(projection);

function landPath(): string {
  const polygons = feature(topo, topo.objects.land).features.flatMap(({ geometry }) =>
    geometry.type === "MultiPolygon" ? geometry.coordinates : geometry.type === "Polygon" ? [geometry.coordinates] : [],
  );
  const kept = polygons.filter(
    (coordinates) => measure.area({ type: "Polygon", coordinates }) >= MIN_AREA,
  );
  return draw({ type: "MultiPolygon", coordinates: kept }) ?? "";
}

function bordersPath(): string {
  const borders = mesh(
    topo,
    topo.objects.countries,
    (a, b) => a !== b && (FOCUS.has(String(a.id)) || FOCUS.has(String(b.id))),
  );
  return draw(borders) ?? "";
}

function placeSites(): PlacedSite[] {
  return SITES.map((site) => {
    const [x, y] = projection([site.lng, site.lat]) ?? [0, 0];
    return { ...site, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
}

/**
 * Undirected links between live sites, as index pairs into `sites`: a minimum
 * spanning tree so outlying clusters (Southeast Alaska) stay connected, plus
 * each site's nearest neighbours for a meshier look.
 */
function meshLinks(sites: PlacedSite[]): [number, number][] {
  const live = sites.flatMap((site, i) => (site.status === "live" ? [i] : []));
  const dist = (a: number, b: number) => Math.hypot(sites[a].x - sites[b].x, sites[a].y - sites[b].y);
  const seen = new Set<string>();
  const links: [number, number][] = [];
  const add = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push([a, b]);
  };

  const inTree = new Set(live.slice(0, 1));
  while (inTree.size < live.length) {
    let best: [number, number] | null = null;
    for (const a of inTree) {
      for (const b of live) {
        if (!inTree.has(b) && (!best || dist(a, b) < dist(...best))) best = [a, b];
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    add(...best);
  }

  for (const i of live) {
    const nearest = live
      .filter((j) => j !== i)
      .sort((a, b) => dist(a, i) - dist(b, i))
      .slice(0, LINKS_PER_SITE);
    for (const j of nearest) add(i, j);
  }
  return links;
}

export const LAND_PATH = landPath();
export const BORDER_PATH = bordersPath();
export const GRATICULE_PATH = draw(geoGraticule().step([10, 10])()) ?? "";
export const PLACED_SITES = placeSites();
export const LINKS = meshLinks(PLACED_SITES);
