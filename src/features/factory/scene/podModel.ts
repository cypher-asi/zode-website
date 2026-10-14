import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { Kit, buildPart, type LineMats } from "../../home/assembly/builders";
import { partBounds, type Motion } from "../../home/assembly/podSpec";
import { COMPUTE_POD } from "../model/catalog";
import { POD_LEN, POD_WID } from "../model/layout";
import { block } from "./infra";

/*
 * The compute pod as the floor draws it: every part from podSpec, built once
 * with the assembly line's `buildPart`, and cheap clones of the lot for each
 * pod on the floor (geometry and materials shared). A pod's state is how far
 * each build step has got; the step in progress places its parts one after
 * another, welded runs growing out and set pieces lowering in.
 */

/** Height of the transport skate a pod rides on. */
const SKATE = 0.24;
const DROP = 2.2;

interface PartTemplate {
  id: string;
  step: number;
  index: number;
  count: number;
  motion: Motion | undefined;
  /** Pod-local (min x, min y, max z) corner, metres. */
  anchor: THREE.Vector3;
  group: THREE.Group;
}

export interface PodTemplates {
  parts: PartTemplate[];
  skate: THREE.Group;
}

export function buildPodTemplates(kit: Kit, mats: LineMats, skateMats: LineMats): PodTemplates {
  const parts: PartTemplate[] = [];
  COMPUTE_POD.steps.forEach((step, s) => {
    step.parts.forEach((part, i) => {
      const b = partBounds(part);
      parts.push({
        id: part.id,
        step: s,
        index: i,
        count: step.parts.length,
        motion: part.motion,
        anchor: new THREE.Vector3(b.x / 1000 - POD_LEN / 2, b.y / 1000, POD_WID / 2 - b.z / 1000),
        group: buildPart(kit, part, mats),
      });
    });
  });
  return { parts, skate: block(kit, skateMats, POD_LEN + 0.2, SKATE, POD_WID - 0.1, { round: 80, roundAxis: "y" }) };
}

interface PartInstance {
  t: PartTemplate;
  group: THREE.Group;
  lines: { obj: LineSegments2; detail: boolean }[];
}

const ease = (u: number) => u * u * (3 - 2 * u);

export class PodInstance {
  readonly root = new THREE.Group();
  /** Index into `trace.pods` of the pod drawn, or -1. */
  pod = -1;
  private readonly parts: PartInstance[];

  constructor(templates: PodTemplates, mats: LineMats) {
    this.root.add(templates.skate.clone());
    const body = new THREE.Group();
    body.position.y = SKATE;
    this.root.add(body);
    this.parts = templates.parts.map((t) => {
      const group = t.group.clone();
      body.add(group);
      const lines: PartInstance["lines"] = [];
      group.traverse((o) => {
        if (o instanceof LineSegments2) lines.push({ obj: o, detail: o.material === mats.detail });
      });
      return { t, group, lines };
    });
    this.root.traverse((o) => (o.userData.podInstance = this));
  }

  /**
   * `progress[s]` is build step s's progress, 0 to 1. The step in progress
   * draws in `active`; parts in `hidden` (the cutaway) aren't drawn at all.
   */
  apply(progress: readonly number[], mats: LineMats, active: LineMats, hidden: ReadonlySet<string>): void {
    for (const p of this.parts) {
      const { t, group } = p;
      const f = progress[t.step] ?? 0;
      const w = f >= 1 ? 1 : Math.min(1, Math.max(0, f * t.count - t.index));
      group.visible = w > 0 && !hidden.has(t.id);
      if (!group.visible) continue;
      const k = ease(w);
      group.position.copy(t.anchor);
      group.scale.set(1, 1, 1);
      if (t.motion === "grow-x") group.scale.x = Math.max(k, 1e-3);
      else if (t.motion === "grow-y") group.scale.y = Math.max(k, 1e-3);
      else if (t.motion === "grow-z") group.scale.z = Math.max(k, 1e-3);
      else group.position.y += (1 - k) * DROP;
      const m = f < 1 ? active : mats;
      for (const l of p.lines) l.obj.material = l.detail ? m.detail : m.struct;
    }
  }
}
