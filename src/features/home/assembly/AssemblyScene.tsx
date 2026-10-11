"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { loadCabinLayers } from "./model/cabinModel";
import {
  Kit,
  SHELL_LAYERS,
  VIEW_DIR,
  buildArm,
  buildBelt,
  buildGantry,
  buildGround,
  buildPad,
  buildPart,
  buildShell,
  type LineMats,
  type Shell,
} from "./builders";
import { PODS } from "./podSpec";
import { ARMS, BELT, BELT_TOP, GANTRY, TIMELINE, createSample, sampleTimeline, type Framing } from "./timeline";
import styles from "./AssemblyLine.module.css";

const BG = 0x0c0c0d; // matches the page's --off-black
const LINE = 0xd2d2d7;
const LINE_DETAIL = 0x5e5e66;
const INFRA = 0x7c7c85;
const INFRA_DETAIL = 0x3f3f45;
const GRID = 0x19191c;
const ACCENT = 0xffa45c; // warm tone of the render lighting
const LINE_WIDTH = 1.15;
const DETAIL_WIDTH = 0.6;
const FOV = 26;
const SPARKS = 22;

export interface AssemblySceneProps {
  /** Called whenever the active stage / step changes. */
  onStep?: (stage: number, step: number) => void;
  /** Called every rendered frame with the active stage's and step's progress (0..1). */
  onTick?: (stageProgress: number, stepProgress: number) => void;
  /** Jump the playhead to `time` seconds; a new `id` re-triggers the same time. */
  seek?: { time: number; id: number } | null;
}

const SEEK_BLEND = 1.1;

/**
 * Autoplaying hidden-line assembly line. Runs only while on screen; with
 * `prefers-reduced-motion` it renders a single still of the finished ZODE.
 */
export function AssemblyScene({ onStep, onTick, seek }: AssemblySceneProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const onStepRef = useRef(onStep);
  const onTickRef = useRef(onTick);
  const seekToRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    onStepRef.current = onStep;
    onTickRef.current = onTick;
  });

  useEffect(() => {
    if (seek) seekToRef.current?.(seek.time);
  }, [seek]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return;
    }
    // Phones and tablets have dense screens but little GPU headroom to spare.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 600);

    const fill = new THREE.MeshBasicMaterial({
      color: BG,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const kit = new Kit(fill);

    scene.add(buildGround(kit, kit.lineMats(GRID, GRID, 1, 1).struct));

    // --- Line infrastructure: conveyor, robot cells, gantry ----------------
    const infraMats = [0, 1, 2].map(() => kit.lineMats(INFRA, INFRA_DETAIL, 1, 0.55));
    const infraGroups = infraMats.map(() => new THREE.Group());
    const beltIn = buildBelt(kit, infraMats[0], BELT.inbound[0], BELT.inbound[1]);
    const beltOut = buildBelt(kit, infraMats[0], BELT.outbound[0], BELT.outbound[1]);
    const beltExit = buildBelt(kit, infraMats[0], BELT.exit[0], BELT.exit[1]);
    infraGroups[0].add(beltIn.group, beltOut.group, beltExit.group);
    const armAccent = kit.lineMats(ACCENT, ACCENT, 1.4, 1.4).struct;
    const arms = ARMS.map((a) => buildArm(kit, infraMats[1], armAccent, a.base));
    for (const [i, a] of ARMS.entries()) {
      infraGroups[1].add(arms[i].group, buildPad(kit, infraMats[1], a.pick[0], a.pick[1], 2.8, 2.2));
    }
    const gantry = buildGantry(kit, infraMats[2]);
    infraGroups[2].add(gantry.group, buildPad(kit, infraMats[2], GANTRY.pick[0], GANTRY.pick[1], 3.2, 2.8));
    scene.add(...infraGroups);

    // --- Pods: one material pair per build step so a step can glow ---------
    const stepMats: (LineMats | null)[] = TIMELINE.steps.map((s) =>
      s.kind === "pod" || s.kind === "shell" ? kit.lineMats(LINE, LINE_DETAIL, LINE_WIDTH, DETAIL_WIDTH) : null,
    );
    const podGroups = PODS.map(() => {
      const g = new THREE.Group();
      scene.add(g);
      return g;
    });
    const partObjs = TIMELINE.parts.map((p) => {
      const g = buildPart(kit, p.part, stepMats[p.step]!);
      podGroups[p.pod].add(g);
      return g;
    });

    // --- Outer shell: loads in the background, clipped by a rising plane ----
    const shellStepIdx = SHELL_LAYERS.map((_, slot) =>
      TIMELINE.steps.findIndex((s) => s.kind === "shell" && s.slot === slot),
    );
    const planes = SHELL_LAYERS.map(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
    const shellMats = shellStepIdx.map((idx, slot) => {
      const mats = stepMats[idx]!;
      mats.struct.clippingPlanes = [planes[slot]];
      mats.detail.clippingPlanes = [planes[slot]];
      mats.detail.opacity = 0.6;
      return mats;
    });
    const shellFills = planes.map((plane, slot) => {
      const m = fill.clone();
      m.clippingPlanes = [plane];
      if (SHELL_LAYERS[slot].translucent) {
        m.transparent = true;
        m.opacity = 0.72;
      }
      kit.materials.push(m);
      return m;
    });
    let shell: Shell | null = null;

    // --- Weld sparks (one burst per arm) -----------------------------------
    const sparkMat = new THREE.PointsMaterial({
      color: ACCENT,
      size: 2.6,
      sizeAttenuation: false,
      transparent: true,
      depthTest: false,
    });
    kit.materials.push(sparkMat);
    const sparks = ARMS.map(() => {
      const g = kit.track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(SPARKS * 3), 3));
      const pts = new THREE.Points(g, sparkMat);
      pts.frustumCulled = false;
      pts.renderOrder = 10;
      scene.add(pts);
      return pts;
    });

    // --- Camera framing ------------------------------------------------------
    let viewW = 1;
    let viewH = 1;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const frameCamera = (f: Framing) => {
      const aspect = viewW / viewH;
      // Portrait screens can't fit the full width without the scene going tiny; let the sides crop.
      const width = f.width * Math.min(1, 0.55 + 0.45 * aspect);
      const dist = Math.max(width / 2 / (tanHalf * aspect), f.height / 2 / tanHalf);
      camera.position.set(f.target[0], f.target[1], f.target[2]).addScaledVector(VIEW_DIR, dist);
      camera.lookAt(f.target[0], f.target[1], f.target[2]);
    };
    // After a seek the camera eases from where it was instead of cutting.
    const shown: Framing = { target: [0, 0, 0], width: 1, height: 1 };
    const blendFrom: Framing = { target: [0, 0, 0], width: 1, height: 1 };
    let blend = 1;
    const showCamera = (f: Framing) => {
      const k = blend >= 1 ? 1 : blend * blend * (3 - 2 * blend);
      for (let i = 0; i < 3; i++) shown.target[i] = blendFrom.target[i] + (f.target[i] - blendFrom.target[i]) * k;
      shown.width = blendFrom.width + (f.width - blendFrom.width) * k;
      shown.height = blendFrom.height + (f.height - blendFrom.height) * k;
      frameCamera(shown);
    };

    // --- Per-frame application of the timeline sample ------------------------
    const sample = createSample();
    const accent = new THREE.Color(ACCENT);
    const lineColor = new THREE.Color(LINE);
    const detailColor = new THREE.Color(LINE_DETAIL);
    let lastStage = -1;
    let lastStep = -1;

    const apply = (t: number) => {
      sampleTimeline(TIMELINE, t, sample);
      renderer.domElement.style.opacity = String(sample.fade);

      for (let i = 0; i < infraGroups.length; i++) {
        const v = sample.infra[i];
        infraGroups[i].visible = v > 0.001;
        infraMats[i].struct.opacity = v;
        infraMats[i].detail.opacity = v;
      }
      armAccent.opacity = sample.infra[1];
      beltIn.slats.position.x = sample.beltIn % beltIn.pitch;
      beltOut.slats.position.x = sample.beltOut % beltOut.pitch;
      beltExit.slats.position.x = sample.beltOut % beltExit.pitch;
      arms[0].setTarget(sample.armTargets[0]);
      arms[1].setTarget(sample.armTargets[1]);
      gantry.setHook(sample.hook);

      for (let k = 0; k < podGroups.length; k++) {
        podGroups[k].visible = sample.podVisible[k];
        podGroups[k].position.set(sample.podX[k], BELT_TOP, 0);
      }

      for (let i = 0; i < partObjs.length; i++) {
        const g = partObjs[i];
        const o = i * 5;
        g.visible = sample.parts[o] > 0;
        if (!g.visible) continue;
        const p = TIMELINE.parts[i];
        g.position.set(
          p.anchor[0] + sample.parts[o + 1],
          p.anchor[1] + sample.parts[o + 2],
          p.anchor[2] + sample.parts[o + 3],
        );
        const s = Math.max(sample.parts[o + 4], 1e-3);
        g.scale.set(p.motion === "grow-x" ? s : 1, p.motion === "grow-y" ? s : 1, p.motion === "grow-z" ? s : 1);
      }

      for (let i = 0; i < stepMats.length; i++) {
        const mats = stepMats[i];
        if (!mats) continue;
        const step = TIMELINE.steps[i];
        const glow = Math.max(sample.stepGlow[i], step.pod >= 0 ? sample.podGlow[step.pod] : 0);
        mats.struct.color.copy(lineColor).lerp(accent, glow * 0.9);
        mats.detail.color.copy(detailColor).lerp(accent, glow * 0.65);
      }

      if (shell) {
        for (let j = 0; j < shell.layers.length; j++) {
          const p = sample.shell[j];
          const [y0, y1] = shell.yRanges[j];
          shell.layers[j].visible = p > 0;
          planes[j].constant = p >= 1 ? 1e4 : y0 + (y1 - y0) * p + 0.01;
        }
      }

      for (let a = 0; a < sparks.length; a++) {
        const pts = sparks[a];
        pts.visible = sample.armWelding[a];
        if (!pts.visible) continue;
        const [tx, ty, tz] = sample.armTargets[a];
        const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < SPARKS; i++) {
          const r = Math.random() * 0.45;
          const th = Math.random() * Math.PI * 2;
          attr.setXYZ(i, tx + Math.cos(th) * r, ty - Math.random() * 0.5 + 0.08, tz + Math.sin(th) * r);
        }
        attr.needsUpdate = true;
      }

      showCamera(sample.camera);

      if (sample.stage !== lastStage || sample.step !== lastStep) {
        lastStage = sample.stage;
        lastStep = sample.step;
        onStepRef.current?.(sample.stage, sample.step);
      }
      onTickRef.current?.(sample.stageProgress, sample.stepProgress);
    };

    // --- Loop: runs only while the section is on screen ---------------------
    let t = reduced ? TIMELINE.stillTime : 0;
    let running = false;
    let frame = 0;
    let last = 0;

    const renderOnce = () => {
      apply(t);
      renderer.render(scene, camera);
    };

    // Objects upload their geometry (and compile shaders) on the first frame they're drawn; doing
    // that up front, off-screen, keeps parts from hitching the frame they first appear.
    const warm = (roots: THREE.Object3D[]) => {
      const culled: THREE.Object3D[] = [];
      for (const root of roots) {
        root.traverse((o) => {
          o.visible = true;
          if (o.frustumCulled) {
            o.frustumCulled = false;
            culled.push(o);
          }
        });
      }
      renderer.render(scene, camera);
      for (const o of culled) o.frustumCulled = true;
      renderOnce();
    };

    // The shell isn't on screen until stage 5, so its load waits until the opening has played.
    let shellRequested = false;
    const requestShell = () => {
      if (shellRequested) return;
      shellRequested = true;
      loadCabinLayers()
        .then((model) => {
          if (disposed) return;
          shell = buildShell(kit, model, shellMats, shellFills);
          scene.add(shell.group);
          for (const plane of planes) plane.constant = 1e4;
          warm([shell.group]);
        })
        .catch(() => {
          // The pods still build and slide in without the outer shell.
        });
    };
    const introEnd = TIMELINE.stageSpans[0][1];

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      t = (t + dt) % TIMELINE.duration;
      if (blend < 1) blend = Math.min(1, blend + dt / SEEK_BLEND);
      if (t >= introEnd) requestShell();
      renderOnce();
    };

    seekToRef.current = (time: number) => {
      requestShell();
      blendFrom.target[0] = shown.target[0];
      blendFrom.target[1] = shown.target[1];
      blendFrom.target[2] = shown.target[2];
      blendFrom.width = shown.width;
      blendFrom.height = shown.height;
      blend = running ? 0 : 1;
      t = Math.min(Math.max(time, 0), TIMELINE.duration - 1e-3);
      if (!running) renderOnce();
    };

    const start = () => {
      if (running || reduced || disposed) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      for (const m of kit.lineMaterials) m.resolution.set(w, h);
      if (!running) renderOnce();
    };
    resize();
    warm([...infraGroups, ...podGroups, ...sparks]);
    if (reduced) requestShell();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const io = new IntersectionObserver((entries) => (entries.some((e) => e.isIntersecting) ? start() : stop()), {
      threshold: 0.05,
    });
    io.observe(container);

    return () => {
      disposed = true;
      seekToRef.current = null;
      stop();
      io.disconnect();
      resizeObserver.disconnect();
      kit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className={styles.canvas} />;
}
