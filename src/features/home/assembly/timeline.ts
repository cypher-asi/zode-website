import { PODS, POD, partBounds, type Motion, type Part, type Tool } from "./podSpec";

/*
 * The whole assembly-line animation as a pure function of time. The schedule
 * (stages -> steps -> parts, belt moves, camera keys) is built once from the
 * pod spec; `sampleTimeline` then reports where everything is at time `t`
 * (seconds) into a preallocated `Sample`, which the scene applies as-is.
 *
 * World frame (metres): the conveyor runs along +x with its top at
 * BELT_TOP, the viewer looks from +z (pods' front faces point at +z), y up.
 * Pod-local frame: origin at the pod's centre line on the belt top.
 */

export type Vec3 = [number, number, number];

export const BELT_TOP = 0.5;
const POD_L = POD.length / 1000;
const POD_W = POD.width / 1000;
export const POD_PITCH = (POD.length + POD.joint) / 1000;

/** Where a pod's floor enters the line, how far each finished pod indexes forward, and the shell centre. */
const FLOOR_IN_FROM = -14;
const INDEX_STEP = 8;
export const SHELL_X = 40;

/** Seconds for the whole scene to fade in, each infra group to reveal (they overlap), and a camera move. */
const SCENE_FADE = 0.35;
const INFRA_FADE = 1;
const CAMERA_MOVE = 2.6;

/** Belt runs reach well past every framing's edges, even on ultrawide screens. */
export const BELT = {
  inbound: [-90, 3.4] as const,
  outbound: [3.4, 28] as const,
  /** Continues out the far end of the shell. */
  exit: [54, 150] as const,
  halfWidth: 1.6,
};

export const ARM_LINKS = { shoulder: 1.3, upper: 3.3, fore: 3.1, wrist: 0.45 };

/** Front-left and back-right robot cells. `pick` is the feeder pad centre (x, z). */
export const ARMS = [
  { base: [-2, 0, 3.2] as Vec3, rest: [-1.1, 3.8, 2.1] as Vec3, pick: [-5.2, 4.7] as const },
  { base: [2, 0, -3.2] as Vec3, rest: [1.1, 3.8, -2.1] as Vec3, pick: [5.2, -4.7] as const },
];

export const GANTRY = {
  x: [-6.8, 6.8] as const,
  z: [-5.6, 5.6] as const,
  railY: 9.6,
  rest: [-2.6, 8.6, -3.6] as Vec3,
  pick: [-3, -4.9] as const,
  /** Height of a carried part's underside while it traverses over the pod. */
  clear: 6.2,
};

export type FramingKey = "overview" | "bay" | "outbound" | "shell" | "final";

export interface Framing {
  target: Vec3;
  width: number;
  height: number;
}

const FRAMINGS: Record<FramingKey, Framing> = {
  overview: { target: [0, 3.2, 0], width: 46, height: 16 },
  bay: { target: [0, 4.8, 0], width: 30, height: 20 },
  outbound: { target: [3, 4.4, 0], width: 36, height: 20 },
  shell: { target: [SHELL_X, 6.5, -1], width: 34, height: 24 },
  final: { target: [SHELL_X, 5.5, -1], width: 42, height: 24 },
};

export interface StageInfo {
  id: string;
  number: string;
  title: string;
  summary: string;
  steps: string[];
}

type StepKind = "infra" | "pod" | "index" | "shell" | "slide" | "couple" | "commission" | "reset";

export interface StepTrack {
  stage: number;
  /** Index within the stage's visible step list, or -1 for hidden steps. */
  index: number;
  label: string;
  start: number;
  end: number;
  kind: StepKind;
  pod: number;
  /** Infra group (belt / arms / gantry) or shell layer group, else -1. */
  slot: number;
  camera?: FramingKey;
}

export interface PartTrack {
  pod: number;
  step: number;
  part: Part;
  motion: Motion;
  tool: Tool;
  arm: number;
  start: number;
  end: number;
  /** Pod-local (min x, min y, max z) corner, metres; geometry extends +x, +y, -z from it. */
  anchor: Vec3;
  size: Vec3;
}

interface MoveTrack {
  start: number;
  end: number;
  dx: number;
  pods: number[];
  inbound: boolean;
  outbound: boolean;
}

export interface Timeline {
  duration: number;
  /** A moment at the end of commissioning, used as the reduced-motion still. */
  stillTime: number;
  stages: StageInfo[];
  /** [start, end] seconds of each stage's visible steps. */
  stageSpans: [number, number][];
  steps: StepTrack[];
  parts: PartTrack[];
  moves: MoveTrack[];
  podStart: number[];
  cameraKeys: CameraKey[];
}

interface CameraKey {
  time: number;
  key: FramingKey;
  /** Where the camera actually is at `time`, so a key that interrupts a move eases on from there. */
  from: Framing;
}

const SHELL_GROUPS = ["Foundation + floor deck", "Steel walls", "Glazed gables", "Roof"] as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function lerp3(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>, k: number): Vec3 {
  out[0] = lerp(a[0], b[0], k);
  out[1] = lerp(a[1], b[1], k);
  out[2] = lerp(a[2], b[2], k);
  return out;
}

function lerpFraming(out: Framing, a: Framing, b: Framing, k: number): Framing {
  lerp3(out.target, a.target, b.target, k);
  out.width = lerp(a.width, b.width, k);
  out.height = lerp(a.height, b.height, k);
  return out;
}

function buildTimeline(): Timeline {
  const stages: StageInfo[] = [];
  const steps: StepTrack[] = [];
  const parts: PartTrack[] = [];
  const moves: MoveTrack[] = [];
  const podStart: number[] = [];
  const cameraKeys: CameraKey[] = [];
  let t = 0;

  const stage = (id: string, title: string, summary: string): number => {
    stages.push({ id, number: String(stages.length + 1).padStart(2, "0"), title, summary, steps: [] });
    return stages.length - 1;
  };

  const step = (
    stageIndex: number,
    kind: StepKind,
    label: string,
    seconds: number,
    extra: Partial<Pick<StepTrack, "pod" | "slot" | "camera">> & { hidden?: boolean } = {},
  ): StepTrack => {
    const { hidden, ...rest } = extra;
    const track: StepTrack = {
      stage: stageIndex,
      index: hidden ? -1 : stages[stageIndex].steps.length,
      label,
      start: t,
      end: t + seconds,
      kind,
      pod: -1,
      slot: -1,
      ...rest,
    };
    if (!hidden) stages[stageIndex].steps.push(label);
    if (track.camera && track.camera !== cameraKeys[cameraKeys.length - 1]?.key) {
      const prev = cameraKeys[cameraKeys.length - 1];
      const from: Framing = { target: [0, 0, 0], width: 0, height: 0 };
      if (prev) lerpFraming(from, prev.from, FRAMINGS[prev.key], easeInOut((t - prev.time) / CAMERA_MOVE));
      else lerpFraming(from, FRAMINGS[track.camera], FRAMINGS[track.camera], 0);
      cameraKeys.push({ time: t, key: track.camera, from });
    }
    steps.push(track);
    t += seconds;
    return track;
  };

  const move = (start: number, end: number, dx: number, pods: number[], inbound: boolean, outbound: boolean) =>
    moves.push({ start, end, dx, pods, inbound, outbound });

  // 01 — the line itself draws in and starts running.
  const line = stage("line", "Assembly Line", "Conveyor, robot welding cells and an overhead gantry come online.");
  step(line, "infra", "Conveyor sections", 1, { slot: 0, camera: "overview" });
  step(line, "infra", "Robot welding cells", 0.8, { slot: 1 });
  step(line, "infra", "Overhead gantry crane", 0.8, { slot: 2 });
  const run = step(line, "index", "Line running", 1.8, { camera: "bay" });
  move(run.start, run.end, 6, [], true, true);

  // 02–04 — one stage per pod, built at the bay then indexed to staging.
  PODS.forEach((pod, podIndex) => {
    const s = stage(pod.id, pod.title, pod.summary);
    podStart[podIndex] = t;
    pod.steps.forEach((spec, i) => {
      const track = step(s, "pod", spec.label, spec.seconds, {
        pod: podIndex,
        camera: i === 0 ? "bay" : undefined,
      });
      const stepIndex = steps.length - 1;
      const n = spec.parts.length;
      spec.parts.forEach((part, k) => {
        let start = track.start;
        let end = track.end;
        let arm = -1;
        if (spec.tool === "gantry") {
          const u = spec.seconds / n;
          start = track.start + k * u;
          end = start + u;
        } else if (spec.tool === "arm") {
          // Two arms alternate; each part's window spans two slots so an
          // arm's consecutive parts touch but never overlap.
          const u = spec.seconds / (n + 1);
          start = track.start + k * u;
          end = track.start + (k + 2) * u;
          arm = k % 2;
        }
        const b = partBounds(part);
        parts.push({
          pod: podIndex,
          step: stepIndex,
          part,
          motion: part.motion ?? (spec.tool === "belt" ? "belt" : spec.tool === "gantry" ? "lower" : "place"),
          tool: spec.tool,
          arm,
          start,
          end,
          anchor: [b.x / 1000 - POD_L / 2, b.y / 1000, POD_W / 2 - b.z / 1000],
          size: [b.w / 1000, b.h / 1000, b.d / 1000],
        });
      });
      if (spec.tool === "belt") move(track.start, track.end, -FLOOR_IN_FROM, [podIndex], true, false);
    });
    const out = step(s, "index", "Index to staging", 2.8, { pod: podIndex, camera: "outbound" });
    move(
      out.start,
      out.end,
      INDEX_STEP,
      PODS.map((_, k) => k).filter((k) => k <= podIndex),
      true,
      true,
    );
  });

  // 05 — the gabled outer shell rises at the end of the line.
  const shell = stage("shell", "Outer Shell", "The gabled steel-and-glass chassis is erected around an open floor deck.");
  SHELL_GROUPS.forEach((label, slot) => {
    step(shell, "shell", label, slot === 3 ? 3.6 : 3, { slot, camera: slot === 0 ? "shell" : undefined });
  });

  // 06 — pods slide into the shell, couple up and power on.
  const fin = stage("final", "Final Assembly", "All three pods slide into the shell, couple and are commissioned.");
  const slide = step(fin, "slide", "Pods slide into the shell", 5.5, { camera: "final" });
  move(slide.start, slide.end, SHELL_X + POD_PITCH - 3 * INDEX_STEP, [0, 1, 2], false, true);
  const couple = step(fin, "couple", "Pods coupled + sealed", 3);
  const mid = (couple.start + couple.end) / 2;
  move(couple.start, mid, INDEX_STEP - POD_PITCH, [1, 2], false, true);
  move(mid, couple.end, INDEX_STEP - POD_PITCH, [2], false, true);
  const commission = step(fin, "commission", "Commissioned · power, cooling, compute", 4.6);
  step(fin, "reset", "", 1.6, { hidden: true });

  const stageSpans = stages.map((_, i) => {
    const own = steps.filter((s) => s.stage === i && s.index !== -1);
    return [own[0].start, own[own.length - 1].end] as [number, number];
  });

  return {
    duration: t,
    stillTime: commission.end - 0.6,
    stages,
    stageSpans,
    steps,
    parts,
    moves,
    podStart,
    cameraKeys,
  };
}

export const TIMELINE: Timeline = buildTimeline();

/** Start time (s) of a stage's visible step, for seeking. */
export function stepStart(stage: number, step = 0, tl: Timeline = TIMELINE): number {
  const track = tl.steps.find((s) => s.stage === stage && s.index === step);
  return track ? track.start : tl.stageSpans[stage][0];
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

export interface Sample {
  stage: number;
  step: number;
  stageProgress: number;
  stepProgress: number;
  /** Whole-scene opacity: fades in at t = 0 and out over the hidden reset step. */
  fade: number;
  /** Reveal (0..1) of the belt, robot arms and gantry. */
  infra: [number, number, number];
  beltIn: number;
  beltOut: number;
  podX: number[];
  podVisible: boolean[];
  /** Commissioning pulse per pod (0..1). */
  podGlow: number[];
  /** Five floats per part: visible (0/1), offset x, y, z (pod-local metres), grow scale. */
  parts: Float32Array;
  /** Accent highlight (0..1) per step. */
  stepGlow: Float32Array;
  /** Build progress (0..1) of each shell layer group. */
  shell: Float32Array;
  armTargets: [Vec3, Vec3];
  armWelding: [boolean, boolean];
  hook: Vec3;
  camera: Framing;
}

export function createSample(tl: Timeline = TIMELINE): Sample {
  return {
    stage: 0,
    step: 0,
    stageProgress: 0,
    stepProgress: 0,
    fade: 0,
    infra: [0, 0, 0],
    beltIn: 0,
    beltOut: 0,
    podX: PODS.map(() => FLOOR_IN_FROM),
    podVisible: PODS.map(() => false),
    podGlow: PODS.map(() => 0),
    parts: new Float32Array(tl.parts.length * 5),
    stepGlow: new Float32Array(tl.steps.length),
    shell: new Float32Array(SHELL_GROUPS.length),
    armTargets: [[...ARMS[0].rest], [...ARMS[1].rest]],
    armWelding: [false, false],
    hook: [...GANTRY.rest],
    camera: { target: [...FRAMINGS.overview.target], width: FRAMINGS.overview.width, height: FRAMINGS.overview.height },
  };
}

function copy3(out: Vec3, a: Readonly<Vec3>): Vec3 {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

const scratchA: Vec3 = [0, 0, 0];
const scratchB: Vec3 = [0, 0, 0];

/** Offset that puts the part's footprint centre on a ground-level pad at world (x, z). */
function padOffset(out: Vec3, p: PartTrack, podX: number, padX: number, padZ: number): Vec3 {
  out[0] = padX - podX - p.size[0] / 2 - p.anchor[0];
  out[1] = -BELT_TOP - p.anchor[1];
  out[2] = padZ + p.size[2] / 2 - p.anchor[2];
  return out;
}

/** World position of the top-centre grip point of a part at a given offset. */
function grip(out: Vec3, p: PartTrack, podX: number, ox: number, oy: number, oz: number): Vec3 {
  out[0] = podX + p.anchor[0] + ox + p.size[0] / 2;
  out[1] = BELT_TOP + p.anchor[1] + oy + p.size[1];
  out[2] = p.anchor[2] + oz - p.size[2] / 2;
  return out;
}

/** World position of the growing end of a welded / extruded part. */
function growTip(out: Vec3, p: PartTrack, podX: number, g: number): Vec3 {
  const [ax, ay, az] = p.anchor;
  const [sx, sy, sz] = p.size;
  out[0] = podX + ax + (p.motion === "grow-x" ? sx * g : sx / 2);
  out[1] = BELT_TOP + ay + (p.motion === "grow-y" ? sy * g : sy / 2);
  out[2] = az - (p.motion === "grow-z" ? sz * g : sz / 2);
  return out;
}

export function sampleTimeline(tl: Timeline, time: number, out: Sample): Sample {
  const t = Math.min(Math.max(time, 0), tl.duration);

  // Caption cursor; the hidden reset step keeps the last visible step shown.
  const reset = tl.steps[tl.steps.length - 1];
  let current = tl.steps[tl.steps.length - 2];
  for (const s of tl.steps) {
    if (t >= s.start && t < s.end && s.index !== -1) {
      current = s;
      break;
    }
  }
  const [s0, s1] = tl.stageSpans[current.stage];
  out.stage = current.stage;
  out.step = current.index;
  out.stageProgress = clamp01((t - s0) / (s1 - s0));
  out.stepProgress = clamp01((t - current.start) / (current.end - current.start));

  // Fade in at the top of the loop, out over the reset step.
  out.fade = t < SCENE_FADE ? smooth(t / SCENE_FADE) : t >= reset.start ? 1 - span(t, reset.start, reset.end) : 1;

  // Infrastructure reveal and shell layers.
  out.infra[0] = out.infra[1] = out.infra[2] = 0;
  out.shell.fill(0);
  for (const s of tl.steps) {
    if (s.kind === "infra") out.infra[s.slot as 0 | 1 | 2] = smooth((t - s.start) / INFRA_FADE);
    if (s.kind === "shell") out.shell[s.slot] = easeInOut((t - s.start) / (s.end - s.start));
  }

  // Belt moves -> pod positions and belt travel.
  out.beltIn = 0;
  out.beltOut = 0;
  for (let k = 0; k < out.podX.length; k++) {
    out.podX[k] = FLOOR_IN_FROM;
    out.podVisible[k] = t >= tl.podStart[k];
    out.podGlow[k] = 0;
  }
  for (const m of tl.moves) {
    const d = easeInOut((t - m.start) / (m.end - m.start)) * m.dx;
    if (m.inbound) out.beltIn += d;
    if (m.outbound) out.beltOut += d;
    for (const k of m.pods) out.podX[k] += d;
  }

  // Step highlight + commissioning pulse.
  for (let i = 0; i < tl.steps.length; i++) {
    const s = tl.steps[i];
    out.stepGlow[i] = t < s.start ? 0 : t <= s.end ? 1 : Math.max(0, 1 - (t - s.end) / 1.4);
    if (s.kind === "commission") {
      for (let k = 0; k < out.podGlow.length; k++) {
        const c = s.start + 0.7 + k * 1.1;
        out.podGlow[k] = Math.max(0, 1 - Math.abs(t - c) / 0.8);
      }
    }
  }

  // Parts, robot arms and gantry hook.
  copy3(out.armTargets[0], ARMS[0].rest);
  copy3(out.armTargets[1], ARMS[1].rest);
  out.armWelding[0] = out.armWelding[1] = false;
  copy3(out.hook, GANTRY.rest);

  for (let i = 0; i < tl.parts.length; i++) {
    const p = tl.parts[i];
    const o = i * 5;
    const podX = out.podX[p.pod];
    const prog = (t - p.start) / (p.end - p.start);
    const active = t >= p.start && t < p.end;
    let visible = prog >= 0 ? 1 : 0;
    let ox = 0,
      oy = 0,
      oz = 0,
      scale = 1;

    switch (p.motion) {
      case "belt":
        visible = out.podVisible[p.pod] ? 1 : 0;
        break;

      case "place": {
        const arm = ARMS[p.arm];
        const pick = padOffset(scratchA, p, podX, arm.pick[0], arm.pick[1]);
        const e = easeInOut(span(prog, 0.22, 0.8));
        ox = pick[0] * (1 - e);
        oy = pick[1] * (1 - e) + Math.sin(Math.PI * e) * 0.9;
        oz = pick[2] * (1 - e);
        if (active) {
          const target = out.armTargets[p.arm];
          if (prog < 0.22) {
            grip(scratchB, p, podX, pick[0], pick[1], pick[2]);
            lerp3(target, arm.rest, scratchB, easeInOut(prog / 0.22));
          } else if (prog < 0.8) {
            grip(target, p, podX, ox, oy, oz);
          } else {
            grip(scratchB, p, podX, 0, 0, 0);
            lerp3(target, scratchB, arm.rest, easeInOut(span(prog, 0.8, 1)));
          }
        }
        break;
      }

      case "lower": {
        const pick = padOffset(scratchA, p, podX, GANTRY.pick[0], GANTRY.pick[1]);
        const clearY = GANTRY.clear - BELT_TOP - p.anchor[1];
        const lift = easeInOut(span(prog, 0.18, 0.38));
        const across = easeInOut(span(prog, 0.38, 0.66));
        const lower = easeInOut(span(prog, 0.66, 0.9));
        ox = pick[0] * (1 - across);
        oz = pick[2] * (1 - across);
        oy = prog < 0.66 ? lerp(pick[1], clearY, lift) : lerp(clearY, 0, lower);
        if (active) {
          if (prog < 0.18) {
            grip(scratchB, p, podX, pick[0], pick[1], pick[2]);
            lerp3(out.hook, GANTRY.rest, scratchB, easeInOut(prog / 0.18));
          } else if (prog < 0.9) {
            grip(out.hook, p, podX, ox, oy, oz);
          } else {
            grip(scratchB, p, podX, 0, 0, 0);
            lerp3(out.hook, scratchB, GANTRY.rest, easeInOut(span(prog, 0.9, 1)));
          }
        }
        break;
      }

      default: {
        // grow-x / grow-y / grow-z: welded or extruded in place.
        const g = smooth(span(prog, 0.15, 0.88));
        scale = g;
        visible = g > 0 ? 1 : 0;
        if (active) {
          const arm = ARMS[p.arm];
          const target = out.armTargets[p.arm];
          if (prog < 0.15) {
            growTip(scratchB, p, podX, 0);
            lerp3(target, arm.rest, scratchB, easeInOut(prog / 0.15));
          } else if (prog < 0.88) {
            growTip(target, p, podX, g);
            out.armWelding[p.arm] = true;
          } else {
            growTip(scratchB, p, podX, 1);
            lerp3(target, scratchB, arm.rest, easeInOut(span(prog, 0.88, 1)));
          }
        }
      }
    }

    out.parts[o] = visible;
    out.parts[o + 1] = ox;
    out.parts[o + 2] = oy;
    out.parts[o + 3] = oz;
    out.parts[o + 4] = scale;
  }

  // Camera: ease from where it was at the latest key to that key's framing.
  let ki = 0;
  for (let i = 0; i < tl.cameraKeys.length; i++) if (tl.cameraKeys[i].time <= t) ki = i;
  const key = tl.cameraKeys[ki];
  lerpFraming(out.camera, key.from, FRAMINGS[key.key], easeInOut((t - key.time) / CAMERA_MOVE));

  return out;
}
