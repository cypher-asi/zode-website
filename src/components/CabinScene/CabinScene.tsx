"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./CabinScene.module.css";

/*
 * Clean architectural line-model of a steep-gable glass cabin (1 unit = 1 ft).
 *
 * Built parametrically and fully symmetric: the right half is computed and the
 * left half is its exact mirror (x -> -x). The building is a 1 ft-thick shell:
 *   - Front gable: a thick picture-frame tracing the roof silhouette around a
 *     full-height glazing wall set back by the shell depth.
 *   - Glazing: a real curtain-wall grid of framed mullions + transoms (thin
 *     boxes with depth), aligned to an even grid and clipped by the rake.
 *   - Roof: two mirrored 1 ft-thick slabs with eave + rake overhangs and
 *     standing-seam lines.
 *   - Side walls (board-clad), a solid back gable, and a simple deck.
 * Every solid is filled with the flat charcoal background so it occludes, then
 * outlined in thin white edge lines (hidden-line drawing).
 */
const BG = 0x2b2b2b; // flat charcoal backdrop
const LINE = 0xeaeaea; // white drawing lines (outer silhouette / structure)
const LINE_SOFT = 0x8a8a92; // light gray for inner detail + window lines

const HW = 13; // half width (26 ft span)
const WALL = 17; // eave / spring-line height
const RIDGE = 33; // ridge height (steep ~51 deg pitch)
const DEPTH = 40; // front-to-back length
const FRONT = DEPTH / 2; // +Z gable face
const BACK = -DEPTH / 2; // -Z gable face
const T = 1; // shell thickness (roof to inner structure)
const FW = 1.25; // facade frame border width

// Inner glazing opening (perpendicular inset FW from the gable outline).
const IHW = HW - FW; // 11.75: opening half-width
const BASE_Y = 0.8; // glazing sill above the deck
const EAVE_INNER_Y = 16.55; // opening corner where the side meets the rake
const PEAK_INNER_Y = 31.02; // opening apex
// Opening rake top as a function of x: y = PEAK_INNER_Y - RAKE_K * |x|.
const RAKE_K = (PEAK_INNER_Y - EAVE_INNER_Y) / IHW;

type Pt = readonly [number, number, number];

/**
 * A solid prism (box topology) from a top quad and an offset to the bottom
 * quad. Box-topology means EdgesGeometry yields clean 12-edge outlines.
 */
function prismGeo(top: readonly [Pt, Pt, Pt, Pt], off: Pt): THREE.BufferGeometry {
  const b = top.map((p) => [p[0] - off[0], p[1] - off[1], p[2] - off[2]] as Pt);
  const v = [...top, ...b];
  const pos: number[] = [];
  for (const p of v) pos.push(p[0], p[1], p[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([
    0, 1, 2, 0, 2, 3, // top
    4, 6, 5, 4, 7, 6, // bottom
    0, 1, 5, 0, 5, 4, // side 0-1
    1, 2, 6, 1, 6, 5, // side 1-2
    2, 3, 7, 2, 7, 6, // side 2-3
    3, 0, 4, 3, 4, 7, // side 3-0
  ]);
  g.computeVertexNormals();
  return g;
}

/** Axis-aligned box centered at (cx, cy, cz). */
function boxAt(
  sx: number,
  sy: number,
  sz: number,
  cx: number,
  cy: number,
  cz: number,
): THREE.BufferGeometry {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  return prismGeo(
    [
      [cx - hx, cy + hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
    ],
    [0, sy, 0],
  );
}

export function CabinScene({
  matchPageBackground = false,
  interactive = true,
  isometric = false,
}: {
  matchPageBackground?: boolean;
  /** When false, the scene is static: no drag-to-rotate or Ctrl+wheel zoom. */
  interactive?: boolean;
  /**
   * When true, frames the cabin from a fixed, zoomed-out top-down isometric
   * angle (front gable toward the lower-left, ridge toward the upper-right).
   */
  isometric?: boolean;
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resolveBg = (): THREE.Color => {
      if (matchPageBackground) {
        const css = getComputedStyle(container)
          .getPropertyValue("--color-bg")
          .trim();
        if (css) return new THREE.Color(css);
      }
      return new THREE.Color(BG);
    };

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const track = <T2 extends THREE.BufferGeometry | THREE.Material>(o: T2): T2 => {
      if (o instanceof THREE.BufferGeometry) geometries.push(o);
      else materials.push(o);
      return o;
    };

    const scene = new THREE.Scene();
    const bgColor = resolveBg();
    scene.background = bgColor.clone();

    // Isometric preset: a narrow FOV at a long distance flattens perspective
    // toward an orthographic, top-down corner view. The camera sits in the
    // +X/+Y/+Z octant so the +Z front gable reads at the lower-left and the
    // -Z back/ridge runs up toward the upper-right.
    const camera = new THREE.PerspectiveCamera(isometric ? 19 : 33, 1, 0.1, 2000);
    if (isometric) {
      camera.position.set(150, 158, 150);
    } else {
      camera.position.set(44, 30, 86);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const matFill = track(
      new THREE.MeshBasicMaterial({
        color: bgColor.clone(),
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    const matLine = track(new THREE.LineBasicMaterial({ color: LINE }));
    const matLineSoft = track(new THREE.LineBasicMaterial({ color: LINE_SOFT }));

    const cabin = new THREE.Group();

    /**
     * Fill a geometry with the background and outline its edges. Structural
     * solids use white lines; pass `soft` for inner detail (e.g. the window
     * grid) to draw the edges in light gray instead.
     */
    const addSolid = (
      geo: THREE.BufferGeometry,
      apply?: (o: THREE.Object3D) => void,
      soft = false,
    ): void => {
      track(geo);
      const mesh = new THREE.Mesh(geo, matFill);
      const edges = new THREE.LineSegments(
        track(new THREE.EdgesGeometry(geo, 1)),
        soft ? matLineSoft : matLine,
      );
      if (apply) {
        apply(mesh);
        apply(edges);
      }
      cabin.add(mesh);
      cabin.add(edges);
    };

    /**
     * Line segments from a flat list of [x,y,z, ...] pairs. White by default;
     * pass `soft` for interior detail lines (drawn in light gray).
     */
    const addLines = (pts: number[], soft = false): void => {
      const g = track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      cabin.add(new THREE.LineSegments(g, soft ? matLineSoft : matLine));
    };

    // === Front gable: 1 ft-thick frame tracing the roof silhouette ===
    const outer = new THREE.Shape();
    outer.moveTo(-HW, 0);
    outer.lineTo(HW, 0);
    outer.lineTo(HW, WALL);
    outer.lineTo(0, RIDGE);
    outer.lineTo(-HW, WALL);
    outer.closePath();
    const innerPts: ReadonlyArray<readonly [number, number]> = [
      [-IHW, BASE_Y],
      [IHW, BASE_Y],
      [IHW, EAVE_INNER_Y],
      [0, PEAK_INNER_Y],
      [-IHW, EAVE_INNER_Y],
    ];
    const hole = new THREE.Path();
    hole.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
    hole.closePath();
    outer.holes.push(hole);
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: T, bevelEnabled: false });
    addSolid(frameGeo, (o) => o.position.set(0, 0, FRONT - T));

    // === Glazing wall, set back by the shell depth ===
    const glassZ = FRONT - T;
    const innerShape = new THREE.Shape();
    innerShape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) {
      innerShape.lineTo(innerPts[i][0], innerPts[i][1]);
    }
    innerShape.closePath();
    const glass = new THREE.Mesh(track(new THREE.ShapeGeometry(innerShape)), matFill);
    glass.position.z = glassZ;
    cabin.add(glass);

    // === Curtain-wall grid: framed mullions + transoms (real boxes) ===
    const MULL = 0.28; // mullion face width
    const MD = 0.5; // mullion depth
    const mz = glassZ + MD / 2 - 0.05; // sit just inside the opening
    const innerRakeTop = (x: number): number => PEAK_INNER_Y - RAKE_K * Math.abs(x);
    const openHalfAt = (y: number): number =>
      y <= EAVE_INNER_Y ? IHW : (PEAK_INNER_Y - y) / RAKE_K;

    // Vertical mullions on an even grid (skip the frame edges at +/-IHW).
    for (const x of [0, 2.94, 5.88, 8.81]) {
      for (const sx of x === 0 ? [0] : [-1, 1]) {
        const px = sx * x;
        const top = innerRakeTop(px) - MULL / 2;
        addSolid(
          boxAt(MULL, top - BASE_Y, MD, px, (BASE_Y + top) / 2, mz),
          undefined,
          true,
        );
      }
    }
    // Horizontal transoms: door head, spring-line beam, upper-triangle bar.
    for (const [y, beam] of [
      [8, 0.32],
      [WALL, 0.45],
      [24, 0.3],
    ] as ReadonlyArray<[number, number]>) {
      const half = openHalfAt(y) - MULL / 2;
      addSolid(boxAt(half * 2, beam, MD, 0, y, mz), undefined, true);
    }

    // === Roof: two mirrored 1 ft-thick slabs ===
    const ovx = 0.8; // eave overhang (x)
    const ovz = 1.4; // rake overhang (z, front/back)
    const yEaveOH = WALL - ((RIDGE - WALL) / HW) * ovx;
    // Outward up-normal of the right slope, scaled to thickness T.
    const nlen = Math.hypot(RIDGE - WALL, HW);
    const nR: Pt = [((RIDGE - WALL) / nlen) * T, (HW / nlen) * T, 0];
    for (const s of [1, -1]) {
      const top: [Pt, Pt, Pt, Pt] = [
        [s * (HW + ovx), yEaveOH, FRONT + ovz],
        [s * (HW + ovx), yEaveOH, BACK - ovz],
        [0, RIDGE, BACK - ovz],
        [0, RIDGE, FRONT + ovz],
      ];
      addSolid(prismGeo(top, [s * nR[0], nR[1], nR[2]]));
    }
    // Standing-seam lines on each slope.
    const seams: number[] = [];
    const sn = 0.06; // nudge above the surface
    for (let z = BACK - ovz + 1.6; z < FRONT + ovz; z += 2.3) {
      for (const s of [1, -1]) {
        const nx = ((RIDGE - WALL) / nlen) * sn * s;
        const ny = (HW / nlen) * sn;
        seams.push(
          s * (HW + ovx) + nx, yEaveOH + ny, z,
          0 + nx, RIDGE + ny, z,
        );
      }
    }
    addLines(seams, true);

    // === Side walls: 1 ft thick, floor to eave ===
    for (const s of [1, -1]) {
      addSolid(boxAt(T, WALL, DEPTH, s * (HW - T / 2), WALL / 2, 0));
    }
    // Vertical board cladding on the outer side faces (both sides).
    const board: number[] = [];
    for (let z = BACK + 1; z < FRONT; z += 1.25) {
      board.push(-HW - 0.02, 0, z, -HW - 0.02, WALL, z);
      board.push(HW + 0.02, 0, z, HW + 0.02, WALL, z);
    }
    addLines(board, true);

    // === Back gable: solid thick pentagon ===
    const backShape = new THREE.Shape();
    backShape.moveTo(-HW, 0);
    backShape.lineTo(HW, 0);
    backShape.lineTo(HW, WALL);
    backShape.lineTo(0, RIDGE);
    backShape.lineTo(-HW, WALL);
    backShape.closePath();
    const backGeo = new THREE.ExtrudeGeometry(backShape, { depth: T, bevelEnabled: false });
    addSolid(backGeo, (o) => o.position.set(0, 0, BACK));

    scene.add(cabin);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // toggled on only while Ctrl is held
    controls.enablePan = false;
    controls.enableRotate = interactive;
    controls.enableDamping = interactive;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 45;
    controls.maxDistance = 400;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.5 - 0.04;
    controls.target.set(0, isometric ? 9 : 15, isometric ? 0 : 3);
    controls.update();

    // Ctrl + wheel zooms the scene; a plain wheel falls through to the page so
    // deck navigation still works. The capture-phase listener runs before
    // OrbitControls' own handler, so the flag is correct when it reads it.
    // Skipped entirely for static (non-interactive) scenes.
    const onWheelCapture = (event: WheelEvent) => {
      controls.enableZoom = event.ctrlKey;
    };
    if (interactive) {
      container.addEventListener("wheel", onWheelCapture, {
        capture: true,
        passive: true,
      });
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const syncBackground = () => {
      const next = resolveBg();
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(next);
      } else {
        scene.background = next;
      }
      matFill.color.copy(next);
    };

    const themeObserver = matchPageBackground
      ? new MutationObserver(syncBackground)
      : null;
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      themeObserver?.disconnect();
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (interactive) {
        container.removeEventListener("wheel", onWheelCapture, {
          capture: true,
        });
      }
      controls.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [matchPageBackground, interactive, isometric]);

  const className = [
    styles.scene,
    matchPageBackground ? styles.matchPageBg : "",
    interactive ? "" : styles.static,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={
        interactive
          ? "Interactive 3D line drawing of a steep-gable glass cabin: a symmetric black shell traces the roof silhouette around a full-height glazing wall with a framed mullion grid, set into a 1-foot-thick front gable, with board-clad side walls and a deck. Drag to rotate; hold Ctrl and scroll to zoom."
          : "3D line drawing of a steep-gable glass cabin shown from a fixed top-down isometric angle: a symmetric black shell traces the roof silhouette around a full-height glazing wall with a framed mullion grid, set into a 1-foot-thick front gable, with board-clad side walls and a deck."
      }
    />
  );
}
