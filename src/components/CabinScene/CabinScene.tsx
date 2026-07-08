"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { MTL_DIFFUSE, SUB_LAYER_IDS, loadCabinLayers } from "./cabinModel";
import { LayerPanel, type RenderStyle } from "./LayerPanel";
import styles from "./CabinScene.module.css";

/*
 * Renders the imported ZODE / Barnhouse asset (public/zode_3D.obj) as the
 * cabin. The single OBJ mesh is split (in cabinModel.ts) into a few height /
 * orientation derived layers that can be toggled, and each layer is drawn in
 * one of two styles:
 *   - "line"      : the original hidden-line drawing (background-filled solids
 *                   occluding white/gray edge lines).
 *   - "realistic" : lit solid surfaces (MeshStandardMaterial in the MTL tan)
 *                   under a hemisphere + directional light.
 */
const BG = 0x2b2b2b; // flat charcoal backdrop
const LINE = 0x9a9aa1; // soft gray for the outer perimeter / structure
const LINE_DETAIL = 0x55555b; // darker gray for inner detail (cladding, seams, mullions)
const LINE_WIDTH = 1.1; // structural line thickness, in CSS pixels
const LINE_DETAIL_WIDTH = 0.45; // much thinner inner-detail lines
const HILITE = 0xffd6a0; // fallback zone glow if the page accent can't be read
const HILITE_WIDTH = 1.6; // zone outline thickness, in CSS pixels

// Twin layout: two cabins end-to-end along Z (gable-to-gable) joined by an
// enclosed connector box (wall height, sitting on the floor base).
const GAP_FRAC = 0.8; // breezeway gap as a fraction of one cabin's Z depth
const BRIDGE_WIDTH_FRAC = 0.5; // connector width along X as a fraction of cabin width
const BRIDGE_OVERLAP = 1.4; // how far the connector tucks into each facing gable
const SLAT_PITCH = 1.6; // spacing between wall slat battens, in model units
const FIT_MARGIN = 1.06; // extra padding when framing the combined model
// Single (interactive) cabin uses a larger margin and frames by the model's
// bounding sphere, which is rotation-invariant, so dragging to any angle never
// clips the cabin out of the viewport.
const SINGLE_FIT_MARGIN = 1.18;

/**
 * Per sub-layer scene objects. Each entry holds one line representation and one
 * lit solid per cabin instance (a single instance normally, two when `twin`).
 */
interface LayerObjects {
  lines: THREE.Object3D[];
  solids: THREE.Object3D[];
}

export function CabinScene({
  matchPageBackground = false,
  interactive = true,
  isometric = false,
  twin = false,
  showPanel,
  highlight,
}: {
  matchPageBackground?: boolean;
  /** When false, the scene is static: no drag-to-rotate or Ctrl+wheel zoom. */
  interactive?: boolean;
  /**
   * When true, frames the cabin from a fixed, zoomed-out top-down isometric
   * angle (front gable toward the lower-left, ridge toward the upper-right).
   */
  isometric?: boolean;
  /**
   * When true, renders two cabins end-to-end (gable-to-gable) with a centered
   * gap joined by an open slatted-deck bridgeway, and frames both.
   */
  twin?: boolean;
  /** Show the layer / style control panel. Defaults to `interactive`. */
  showPanel?: boolean;
  /**
   * When set (twin layout only), lights up one named zone of the assembly in
   * the page accent color: "noc", "compute", "cooling", "power", or
   * "generators".
   */
  highlight?: string | null;
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // Imperatively applies the current style + layer visibility to the built
  // scene objects. Defined inside the build effect; called from the handlers
  // below. Keeping it out of a React effect avoids mutating effect-owned
  // values from a separate effect (react-hooks immutability rule) while still
  // matching three.js's imperative model.
  const applyRef = useRef<() => void>(() => {});
  // Shows only the active highlight zone's overlay group. Built by the scene
  // effect; driven imperatively (like applyRef) so changing zones never
  // re-parses the model.
  const applyHighlightRef = useRef<() => void>(() => {});
  const highlightRef = useRef<string | null | undefined>(highlight);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);
  const [style, setStyle] = useState<RenderStyle>("line");
  const styleRef = useRef<RenderStyle>(style);
  const [layers, setLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SUB_LAYER_IDS.map((id) => [id, true])),
  );
  const layersRef = useRef(layers);

  const panelVisible = (showPanel ?? interactive) && !loading && !failed;

  // Build the scene once per framing configuration. Layer/style toggles are
  // applied separately so the ~7.7 MB model is never re-parsed on a toggle.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setLoading(true);
    setFailed(false);

    const resolveBg = (): THREE.Color => {
      if (matchPageBackground) {
        const css = getComputedStyle(container)
          .getPropertyValue("--color-bg")
          .trim();
        if (css) return new THREE.Color(css);
      }
      return new THREE.Color(BG);
    };

    // Zone highlights follow the page accent (`--color-accent`), which the
    // product page overrides to its sun-toned amber, so the lit zone matches
    // the surrounding accent UI instead of using the brand green.
    const resolveAccent = (): THREE.Color => {
      const css = getComputedStyle(container)
        .getPropertyValue("--color-accent")
        .trim();
      if (css) {
        try {
          return new THREE.Color(css);
        } catch {
          /* fall through to the constant */
        }
      }
      return new THREE.Color(HILITE);
    };

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const scene = new THREE.Scene();
    const bgColor = resolveBg();
    scene.background = bgColor.clone();

    const camera = new THREE.PerspectiveCamera(isometric ? 19 : 33, 1, 0.1, 2000);
    if (isometric) {
      // Frame the cabin larger so its on-screen line density (and therefore
      // apparent line color) matches the closer, full-bleed interactive scene.
      camera.position.set(92, 99, 92);
    } else {
      camera.position.set(44, 30, 86);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const matFill = new THREE.MeshBasicMaterial({
      color: bgColor.clone(),
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    // Fat lines (LineMaterial) so thickness is actually honored; plain
    // LineBasicMaterial.linewidth is ignored by most WebGL drivers.
    const matStruct = new LineMaterial({ color: LINE, linewidth: LINE_WIDTH });
    const matDetail = new LineMaterial({
      color: LINE_DETAIL,
      linewidth: LINE_DETAIL_WIDTH,
    });
    const matStandard = new THREE.MeshStandardMaterial({
      color: MTL_DIFFUSE.clone(),
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    // Zone-highlight overlays draw on top of the line drawing (depthTest off,
    // high renderOrder) so a lit region reads through the model.
    const accent = resolveAccent();
    const matHiliteFill = new THREE.MeshBasicMaterial({
      color: accent.clone(),
      transparent: true,
      opacity: 0.22,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
    });
    const matHilite = new LineMaterial({
      color: accent.clone(),
      linewidth: HILITE_WIDTH,
      transparent: true,
      depthTest: false,
    });
    materials.push(matFill, matStruct, matDetail, matStandard, matHiliteFill, matHilite);

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
    controls.target.set(0, isometric ? 12 : 15, 0);
    controls.update();

    // OrbitControls sets `touch-action: none` on the canvas in its constructor,
    // which swallows vertical scroll on touch devices and traps the user on the
    // slide. Allow vertical panning (page scroll) so mobile users can scroll
    // past the model; horizontal single-finger drags still rotate it. Static
    // scenes are fully non-interactive (pointer-events: none via CSS), so no
    // override is needed there.
    if (interactive) {
      renderer.domElement.style.touchAction = "pan-y";
    }

    const onWheelCapture = (event: WheelEvent) => {
      controls.enableZoom = event.ctrlKey;
    };
    if (interactive) {
      container.addEventListener("wheel", onWheelCapture, {
        capture: true,
        passive: true,
      });
    }

    // Re-frames the camera for the current aspect ratio. Assigned once the
    // model loads and its bounding radius is known; a no-op until then.
    let refit: () => void = () => {};

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // updateStyle must stay on (the default): it sets the canvas CSS size to
      // the container's CSS pixels while the drawing buffer scales by
      // devicePixelRatio. Passing `false` leaves the canvas with no CSS size, so
      // on high-DPI screens (phones/retina) it falls back to its buffer size
      // (w * DPR) and overflows the viewport, pushing the model off-screen.
      renderer.setSize(w, h);
      // LineMaterial needs the viewport size to size screen-space line widths.
      matStruct.resolution.set(w, h);
      matDetail.resolution.set(w, h);
      matHilite.resolution.set(w, h);
      // Keep the model framed when the viewport aspect changes (e.g. a portrait
      // phone, or rotating the device), not just on first load.
      refit();
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

    // Lights are only relevant in the realistic style; their visibility is
    // driven by the apply-effect below.
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404048, 1.05);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(48, 72, 36);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-40, 30, -50);
    scene.add(hemi, dir, dir2);

    loadCabinLayers()
      .then((model) => {
        if (disposed) return;
        const cabin = new THREE.Group();
        const layerObjs: Record<string, LayerObjects> = {};
        for (const id of model.present) layerObjs[id] = { lines: [], solids: [] };

        // Builds a fat-line object from a flat [x,y,z, ...] segment array, or
        // null when the tier has no segments for this sub-layer.
        const makeLines = (
          data: Float32Array,
          mat: LineMaterial,
        ): LineSegments2 | null => {
          if (data.length === 0) return null;
          const g = new LineSegmentsGeometry();
          g.setPositions(data);
          g.computeBoundingSphere();
          geometries.push(g);
          return new LineSegments2(g, mat);
        };

        // Builds one cabin instance (line + lit solid per sub-layer) parented
        // to a group translated by `offsetZ` along the long axis, and records
        // its objects so layer/style toggles can drive every instance at once.
        const buildCabinUnit = (offsetZ: number): void => {
          const unit = new THREE.Group();
          unit.position.z = offsetZ;
          for (const id of model.present) {
            // solidGeo is owned by the module cache and reused across mounts,
            // so it is NOT tracked for disposal here.
            const solidGeo = model.solids[id];

            const lineGroup = new THREE.Group();
            lineGroup.add(new THREE.Mesh(solidGeo, matFill));
            const structLines = makeLines(model.edges[id].struct, matStruct);
            const detailLines = makeLines(model.edges[id].detail, matDetail);
            if (structLines) lineGroup.add(structLines);
            if (detailLines) lineGroup.add(detailLines);

            const solidMesh = new THREE.Mesh(solidGeo, matStandard);

            unit.add(lineGroup);
            unit.add(solidMesh);
            layerObjs[id].lines.push(lineGroup);
            layerObjs[id].solids.push(solidMesh);
          }
          cabin.add(unit);
        };

        // Enclosed connector box spanning the gap between the two facing gable
        // ends: wall-height, bottom flush with the floor base (y = 0). Returned
        // as a line-style group (background-filled box + gray edge/batten lines)
        // plus a lit solid for the realistic style.
        const buildBridge = (
          gap: number,
        ): { line: THREE.Group; solid: THREE.Mesh } => {
          const w = model.size.x * BRIDGE_WIDTH_FRAC;
          const halfW = w / 2;
          const z0 = -gap / 2 - BRIDGE_OVERLAP;
          const z1 = gap / 2 + BRIDGE_OVERLAP;
          const span = z1 - z0;
          const cz = (z0 + z1) / 2;
          const h = model.eaveY; // similar height to the cabin walls
          const xs = [-halfW, halfW];

          const box = new THREE.BoxGeometry(w, h, span);
          box.translate(0, h / 2, cz); // bottom along the floor base
          geometries.push(box);

          // Structural: the 12 box edges (bottom + top rectangles + verticals).
          const struct: number[] = [];
          const seg = (
            ax: number,
            ay: number,
            az: number,
            bx: number,
            by: number,
            bz: number,
          ): void => {
            struct.push(ax, ay, az, bx, by, bz);
          };
          for (const y of [0, h]) {
            seg(-halfW, y, z0, halfW, y, z0);
            seg(halfW, y, z0, halfW, y, z1);
            seg(halfW, y, z1, -halfW, y, z1);
            seg(-halfW, y, z1, -halfW, y, z0);
          }
          for (const x of xs) {
            seg(x, 0, z0, x, h, z0);
            seg(x, 0, z1, x, h, z1);
          }

          // Detail: slat battens that wrap each side wall and continue across
          // the top, so the top lines line up with the side-wall lines.
          const detail: number[] = [];
          for (let z = z0 + SLAT_PITCH; z < z1 - SLAT_PITCH / 2; z += SLAT_PITCH) {
            for (const x of xs) detail.push(x, 0, z, x, h, z);
            detail.push(-halfW, h, z, halfW, h, z);
          }

          const line = new THREE.Group();
          line.add(new THREE.Mesh(box, matFill));
          const structLines = makeLines(new Float32Array(struct), matStruct);
          const detailLines = makeLines(new Float32Array(detail), matDetail);
          if (structLines) line.add(structLines);
          if (detailLines) line.add(detailLines);

          const solid = new THREE.Mesh(box, matStandard);
          return { line, solid };
        };

        // Adds a translucent accent box + crisp accent wireframe to a zone group.
        const addHiliteBox = (
          group: THREE.Group,
          cx: number,
          cy: number,
          cz: number,
          dx: number,
          dy: number,
          dz: number,
        ): void => {
          const geo = new THREE.BoxGeometry(dx, dy, dz);
          geo.translate(cx, cy, cz);
          geometries.push(geo);
          const mesh = new THREE.Mesh(geo, matHiliteFill);
          mesh.renderOrder = 999;
          group.add(mesh);
          const eg = new THREE.EdgesGeometry(geo);
          const lines = makeLines(
            eg.attributes.position.array as Float32Array,
            matHilite,
          );
          eg.dispose();
          if (lines) {
            lines.renderOrder = 1000;
            group.add(lines);
          }
        };

        const zoneGroups: Record<string, THREE.Group> = {};

        // Builds the accent-colored zone overlays for the twin (product) layout. Left
        // cabin sits at +offsetZ (screen-left), right cabin at -offsetZ;
        // generators are placed beyond the right cabin.
        const buildZones = (offsetZ: number): void => {
          const sx = model.size.x;
          const sz = model.size.z;
          const y0 = model.floorY;
          const y1 = model.eaveY;
          const hy = y1 - y0; // interior wall height
          const cyMid = (y0 + y1) / 2;
          const wx = sx * 0.78; // interior width (inside the walls)
          const halfZ = sz / 2;

          const newZone = (id: string): THREE.Group => {
            const g = new THREE.Group();
            g.visible = false;
            zoneGroups[id] = g;
            cabin.add(g);
            return g;
          };

          // 01 NOC: front 15% of the left cabin.
          const nocLen = sz * 0.15;
          const nocCz = offsetZ + halfZ - nocLen / 2;
          addHiliteBox(newZone("noc"), 0, cyMid, nocCz, wx, hy, nocLen * 0.9);

          // 02 Compute Hall: rear 85% of the left cabin + 12 racks (2 x 6).
          const compute = newZone("compute");
          const hallLen = sz * 0.85;
          const hallCz = offsetZ - halfZ + hallLen / 2;
          addHiliteBox(compute, 0, cyMid, hallCz, wx, hy, hallLen * 0.94);
          const rackLen = hallLen * 0.86;
          const rackStep = rackLen / 6;
          const rackDz = rackStep * 0.62;
          const rackDx = wx * 0.2;
          const rackDy = hy * 0.62;
          const rackCy = y0 + rackDy / 2;
          for (let col = 0; col < 6; col++) {
            const rz = hallCz - rackLen / 2 + rackStep * (col + 0.5);
            for (const rx of [-wx * 0.24, wx * 0.24]) {
              addHiliteBox(compute, rx, rackCy, rz, rackDx, rackDy, rackDz);
            }
          }

          // 03 Cooling Yard: 6 units inside the bridge, 3 rows x 2 columns.
          const cooling = newZone("cooling");
          const bw = sx * BRIDGE_WIDTH_FRAC * 0.78;
          const gapSpan = gap * 0.84;
          const unitDx = bw * 0.36;
          const unitDz = (gapSpan / 3) * 0.6;
          const unitDy = (y1 - 0) * 0.5;
          const unitCy = unitDy / 2;
          for (let row = 0; row < 3; row++) {
            const cz = -gapSpan / 2 + (gapSpan / 3) * (row + 0.5);
            for (const cx of [-bw * 0.25, bw * 0.25]) {
              addHiliteBox(cooling, cx, unitCy, cz, unitDx, unitDy, unitDz);
            }
          }

          // 04 Power Hall: the entire right cabin interior.
          addHiliteBox(newZone("power"), 0, cyMid, -offsetZ, wx, hy, sz * 0.92);

          // 05 Generators: a row of 4 boxes beyond the right cabin (far right).
          const generators = newZone("generators");
          const genDy = y1 * 0.55;
          const genDx = sx * 0.16;
          const genDz = sz * 0.18;
          const genCy = genDy / 2;
          const genCz = -offsetZ - halfZ - genDz * 0.9;
          for (let i = 0; i < 4; i++) {
            const gx = (i - 1.5) * (sx * 0.26);
            addHiliteBox(generators, gx, genCy, genCz, genDx, genDy, genDz);
          }
        };

        const gap = model.size.z * GAP_FRAC;
        let bridge: { line: THREE.Group; solid: THREE.Mesh } | null = null;
        if (twin) {
          const offsetZ = (model.size.z + gap) / 2;
          buildCabinUnit(offsetZ);
          buildCabinUnit(-offsetZ);
          bridge = buildBridge(gap);
          cabin.add(bridge.line, bridge.solid);
          buildZones(offsetZ);
        } else {
          buildCabinUnit(0);
        }

        scene.add(cabin);

        // Frame by the model's circumscribed bounding sphere (rotation-
        // invariant, so no drag angle clips it) accounting for BOTH axes of the
        // frustum: on a portrait viewport the horizontal FOV is much narrower
        // than the vertical one, so framing by vertical FOV alone lets a wide
        // model overflow left/right. Fit to whichever FOV is smaller.
        const radius = twin
          ? 0.5 * Math.hypot(2 * model.size.z + gap, model.size.x, model.size.y)
          : 0.5 * Math.hypot(model.size.x, model.size.y, model.size.z);
        const margin = twin ? FIT_MARGIN : SINGLE_FIT_MARGIN;

        const fitDistance = (): number => {
          const vFov = THREE.MathUtils.degToRad(camera.fov);
          const aspect = camera.aspect || 1;
          // Horizontal FOV derived from the vertical FOV and aspect ratio.
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
          const minFov = Math.min(vFov, hFov);
          return (radius * margin) / Math.sin(minFov / 2);
        };

        refit = () => {
          const fitDist = fitDistance();
          // Preserve the current viewing direction (so user rotation survives a
          // resize) and only adjust the distance to keep the model framed.
          const dir = camera.position.clone().normalize();
          camera.position.copy(dir.multiplyScalar(fitDist));
          controls.maxDistance = Math.max(controls.maxDistance, fitDist * 1.6);
          if (!twin) {
            controls.minDistance = Math.min(controls.minDistance, fitDist * 0.6);
          }
          controls.update();
        };
        refit();

        const ids = model.present;
        const lights = [hemi, dir, dir2];
        applyRef.current = () => {
          const s = styleRef.current;
          const ls = layersRef.current;
          for (const id of ids) {
            const on = ls[id] ?? true;
            for (const o of layerObjs[id].lines) o.visible = on && s === "line";
            for (const o of layerObjs[id].solids)
              o.visible = on && s === "realistic";
          }
          if (bridge) {
            bridge.line.visible = s === "line";
            bridge.solid.visible = s === "realistic";
          }
          for (const light of lights) light.visible = s === "realistic";
        };
        applyRef.current();

        applyHighlightRef.current = () => {
          const h = highlightRef.current;
          for (const id of Object.keys(zoneGroups)) {
            zoneGroups[id].visible = id === h;
          }
        };
        applyHighlightRef.current();

        setAvailable(model.present);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load cabin model", err);
        if (!disposed) {
          setLoading(false);
          setFailed(true);
        }
      });

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
      disposed = true;
      applyRef.current = () => {};
      applyHighlightRef.current = () => {};
      themeObserver?.disconnect();
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (interactive) {
        container.removeEventListener("wheel", onWheelCapture, {
          capture: true,
        });
      }
      controls.dispose();
      // Per-layer geometries are owned by the module cache and reused across
      // mounts, so they are intentionally not disposed here.
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [matchPageBackground, interactive, isometric, twin]);

  useEffect(() => {
    highlightRef.current = highlight;
    applyHighlightRef.current();
  }, [highlight]);

  const changeStyle = (next: RenderStyle): void => {
    styleRef.current = next;
    setStyle(next);
    applyRef.current();
  };

  const setLayerStates = (updates: Record<string, boolean>): void => {
    const next = { ...layersRef.current, ...updates };
    layersRef.current = next;
    setLayers(next);
    applyRef.current();
  };

  const toggleLayer = (id: string): void => {
    setLayerStates({ [id]: !(layersRef.current[id] ?? true) });
  };

  const setMany = (ids: string[], value: boolean): void => {
    setLayerStates(Object.fromEntries(ids.map((id) => [id, value])));
  };

  const className = [
    styles.scene,
    matchPageBackground ? styles.matchPageBg : "",
    interactive ? "" : styles.static,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={className}
        role="img"
        aria-label={
          interactive
            ? "Interactive 3D model of the steep-gable ZODE unit imported from a CAD asset, shown as a line drawing of the roof, glazing, walls and deck. Drag to rotate; hold Ctrl and scroll to zoom. Use the panel to toggle layers and switch between line and realistic styling."
            : twin
              ? "3D model of two steep-gable ZODE units set end-to-end, joined by an enclosed wall-height connector box with slatted side walls, shown from a fixed top-down isometric angle as a line drawing."
              : "3D model of the steep-gable ZODE unit imported from a CAD asset, shown from a fixed top-down isometric angle as a line drawing of the roof, glazing, walls and deck."
        }
      />
      {loading && <div className={styles.status}>Loading model...</div>}
      {failed && <div className={styles.status}>Model unavailable</div>}
      {panelVisible && (
        <LayerPanel
          style={style}
          onStyleChange={changeStyle}
          layers={layers}
          available={available}
          onToggleLayer={toggleLayer}
          onSetMany={setMany}
        />
      )}
    </div>
  );
}
