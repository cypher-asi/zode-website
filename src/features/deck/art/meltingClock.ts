import { Sketch, project, type P3 } from "@/features/zode-drawings/lineArt";

/**
 * A corner the case drapes round, in (y, z), with its radius. Corners
 * alternate: over an edge (from running +y to running down), then into its
 * foot (from running down to running +y again), and so on.
 */
export type Corner = readonly [y: number, z: number, r: number];

export interface MeltingClock {
  /** The point on the dial face `r` out from the hub, `a` radians clockwise from twelve. */
  polar: (r: number, a: number) => P3;
  /** A hand `r` long pointing at `a`, from the hub out, bent with the face. */
  hand: (r: number, a: number) => P3[];
}

/**
 * A soft watch, after Dalí: lying on a top at `x` across, its hub `hub` short
 * of the first corner, melting downhill toward +y and draped over `corners`,
 * the case facing up or out between folds as the drawings' boxes do. Draws the
 * crown, case, dial and quarter ticks; the caller adds the hands and lights.
 */
export function meltingClock(
  s: Sketch,
  {
    x: X,
    r: R,
    thickness: T,
    hub: HUB,
    drip: DRIP,
    taper: TAPER = 0.32,
    lean: LEAN = 0,
    corners,
  }: {
    x: number;
    r: number;
    thickness: number;
    hub: number;
    drip: number;
    taper?: number;
    lean?: number;
    corners: readonly Corner[];
  },
): MeltingClock {
  const [y0, z0, r0] = corners[0];
  const profile: [number, number][] = [[y0 - r0 - 200, z0]];
  corners.forEach(([y, z, r], i) => {
    const [cy, cz, from, to] = i % 2 ? [y + r, z + r, Math.PI, 1.5 * Math.PI] : [y - r, z - r, 0.5 * Math.PI, 0];
    for (let k = 0; k <= 12; k++) {
      const a = from + ((to - from) * k) / 12;
      profile.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  });
  const [yn, zn] = corners[corners.length - 1];
  profile.push(corners.length % 2 ? [yn, zn - 200] : [yn + 200, zn]);
  const lengths = [0];
  for (let i = 1; i < profile.length; i++) {
    const [[ay, az], [by, bz]] = [profile[i - 1], profile[i]];
    lengths.push(lengths[i - 1] + Math.hypot(by - ay, bz - az));
  }
  /** The case back `t` along the profile past the first corner's start: where it is, and the way out of the surface. */
  const along = (t: number) => {
    const q = t + lengths[1];
    let i = 0;
    while (i < profile.length - 2 && lengths[i + 1] < q) i++;
    const [[ay, az], [by, bz]] = [profile[i], profile[i + 1]];
    const L = lengths[i + 1] - lengths[i];
    const [ty, tz] = [(by - ay) / L, (bz - az) / L];
    const f = q - lengths[i];
    return [ay + ty * f, az + tz * f, -tz, ty] as const;
  };
  /** Halfway round each corner, where the case turns from facing up to facing out, or back. */
  const folds = corners.map((_, i) => lengths[1 + 13 * i + 6] - lengths[1]);

  const melt = (v: number) => Math.max(0, v / R + 0.25) ** 2;
  /** How far the dial point (`u` toward three, `v` toward six from the hub) has run along the profile. */
  const run = (u: number, v: number) => HUB + v + DRIP * melt(v) * (1 + (0.2 * u) / R);
  /** That dial point, `d` up from the case back. */
  const at = (u: number, v: number, d = T): P3 => {
    const [y, z, ny, nz] = along(run(u, v));
    return [X + u * (1 - TAPER * melt(v)) + LEAN * melt(v), y + d * ny, z + d * nz];
  };
  const polar = (r: number, a: number, d?: number) => at(r * Math.sin(a), -r * Math.cos(a), d);
  const ring = (r: number, d?: number) =>
    Array.from({ length: 96 }, (_, k) => polar(r, (k / 96) * Math.PI * 2, d));
  const rim = (a0: number, a1: number, n: number) =>
    Array.from({ length: n + 1 }, (_, k) => polar(R, a0 + ((a1 - a0) * k) / n));
  const hand = (r: number, a: number) => Array.from({ length: 9 }, (_, k) => polar((r * k) / 8, a));

  /** Bisects for the boundary between where `before` holds, toward `lo`, and where it doesn't. */
  const solve = (lo: number, hi: number, before: (q: number) => boolean) => {
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (before(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  /** Where the rim crosses `fold`, on the three side and the nine. */
  const crossing = (fold: number) => {
    const before = (a: number) => run(R * Math.sin(a), -R * Math.cos(a)) < fold;
    const [right, left] = [solve(0, Math.PI, before), solve(2 * Math.PI, Math.PI, before)];
    return { fold, right, left, uR: R * Math.sin(right), uL: R * Math.sin(left) };
  };
  const crease = ({ fold }: { fold: number }, u0: number, u1: number) =>
    Array.from({ length: 17 }, (_, k) => {
      const u = u0 + ((u1 - u0) * k) / 16;
      return at(u, solve(-R, R, (v) => run(u, v) < fold));
    });

  const q = R / 15;
  const [, cy, cz = 0] = at(0, -R, 0);
  s.box(X - 2.5 * q, cy - 4.5 * q, 5 * q, 2.5 * q, cz, T + 1.5 * q);
  s.box(X - 1.25 * q, cy - 2 * q, 2.5 * q, 2.5 * q, cz + 0.5 * q, T - q);

  const [front, rear] = [ring(R), ring(R, 0)];
  s.face(rear, s.cls.sideR);
  const turn = (i: number) => {
    const [[ax, ay], [bx, by]] = [project(front[(i + 95) % 96]), project(front[(i + 1) % 96])];
    const [[fx, fy], [rx, ry]] = [project(front[i]), project(rear[i])];
    return Math.sign((bx - ax) * (ry - fy) - (by - ay) * (rx - fx));
  };
  for (let i = 0; i < 96; i++) if (turn(i) !== turn((i + 1) % 96)) s.line([front[i], rear[i]], s.cls.edge);

  const deepest = Math.max(...Array.from({ length: 96 }, (_, k) => run(R * Math.sin((k / 48) * Math.PI), -R * Math.cos((k / 48) * Math.PI))));
  const cuts = folds.filter((f) => f < deepest - 0.5).map(crossing);
  const facing = (i: number) => (i % 2 ? s.cls.sideL : s.cls.top);
  if (!cuts.length) s.face(front, s.cls.top);
  else {
    const [first, last] = [cuts[0], cuts[cuts.length - 1]];
    s.face([...rim(first.left - 2 * Math.PI, first.right, 64), ...crease(first, first.uR, first.uL)], facing(0));
    for (let i = 1; i < cuts.length; i++) {
      const [a, b] = [cuts[i - 1], cuts[i]];
      s.face(
        [...rim(a.right, b.right, 12), ...crease(b, b.uR, b.uL), ...rim(b.left, a.left, 12), ...crease(a, a.uL, a.uR)],
        facing(i),
      );
    }
    s.face([...rim(last.right, last.left, 32), ...crease(last, last.uL, last.uR)], facing(cuts.length));
  }
  s.face(ring(0.8 * R), s.cls.fine);
  for (let k = 0; k < 4; k++) s.line([polar(0.8 * R, (k * Math.PI) / 2), polar(0.6 * R, (k * Math.PI) / 2)], s.cls.edge);

  return { polar, hand };
}
