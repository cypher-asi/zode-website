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

// Twin layout: two cabins end-to-end along Z (gable-to-gable) with a breezeway.
const GAP_FRAC = 0.4; // breezeway gap as a fraction of one cabin's Z depth
const BRIDGE_WIDTH_FRAC = 0.5; // deck width along X as a fraction of cabin width
const BRIDGE_OVERLAP = 1.4; // how far the deck tucks under each facing gable
const SLAT_PITCH = 1.6; // spacing between slat seam lines, in model units
const FIT_MARGIN = 1.06; // extra padding when framing the combined model

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
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // Imperatively applies the current style + layer visibility to the built
  // scene objects. Defined inside the build effect; called from the handlers
  // below. Keeping it out of a React effect avoids mutating effect-owned
  // values from a separate effect (react-hooks immutability rule) while still
  // matching three.js's imperative model.
  const applyRef = useRef<() => void>(() => {});

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
    materials.push(matFill, matStruct, matDetail, matStandard);

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
      // LineMaterial needs the viewport size to size screen-space line widths.
      matStruct.resolution.set(w, h);
      matDetail.resolution.set(w, h);
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

        // Open slatted-deck breezeway spanning the gap between the two facing
        // gable ends. Returned as a line-style group (background-filled slab +
        // gray edge/slat lines) plus a lit solid for the realistic style.
        const buildBridge = (
          gap: number,
        ): { line: THREE.Group; solid: THREE.Mesh } => {
          const w = model.size.x * BRIDGE_WIDTH_FRAC;
          const halfW = w / 2;
          const z0 = -gap / 2 - BRIDGE_OVERLAP;
          const z1 = gap / 2 + BRIDGE_OVERLAP;
          const span = z1 - z0;
          const t = Math.max(0.6, model.size.y * 0.02); // thin slab
          const top = model.floorY;
          const cz = (z0 + z1) / 2;

          const slab = new THREE.BoxGeometry(w, t, span);
          slab.translate(0, top - t / 2, cz);
          geometries.push(slab);

          // Structural: deck-top perimeter + the two long stringer edges.
          const struct: number[] = [];
          const edge = (
            ax: number,
            az: number,
            bx: number,
            bz: number,
          ): void => {
            struct.push(ax, top, az, bx, top, bz);
          };
          edge(-halfW, z0, halfW, z0);
          edge(halfW, z0, halfW, z1);
          edge(halfW, z1, -halfW, z1);
          edge(-halfW, z1, -halfW, z0);

          // Detail: the slat seams running across the deck width.
          const detail: number[] = [];
          for (let z = z0 + SLAT_PITCH; z < z1 - SLAT_PITCH / 2; z += SLAT_PITCH) {
            detail.push(-halfW, top, z, halfW, top, z);
          }

          const line = new THREE.Group();
          line.add(new THREE.Mesh(slab, matFill));
          const structLines = makeLines(new Float32Array(struct), matStruct);
          const detailLines = makeLines(new Float32Array(detail), matDetail);
          if (structLines) line.add(structLines);
          if (detailLines) line.add(detailLines);

          const solid = new THREE.Mesh(slab, matStandard);
          return { line, solid };
        };

        const gap = model.size.z * GAP_FRAC;
        let bridge: { line: THREE.Group; solid: THREE.Mesh } | null = null;
        if (twin) {
          const offsetZ = (model.size.z + gap) / 2;
          buildCabinUnit(offsetZ);
          buildCabinUnit(-offsetZ);
          bridge = buildBridge(gap);
          cabin.add(bridge.line, bridge.solid);
        } else {
          buildCabinUnit(0);
        }

        scene.add(cabin);

        // Keep the existing isometric viewing direction, but pull the camera
        // back far enough to frame both cabins + the bridge along Z.
        if (twin) {
          const totalZ = 2 * model.size.z + gap;
          const radius =
            0.5 * Math.hypot(totalZ, model.size.x, model.size.y);
          const fov = THREE.MathUtils.degToRad(camera.fov);
          const fitDist = (radius * FIT_MARGIN) / Math.sin(fov / 2);
          camera.position.copy(
            camera.position.clone().normalize().multiplyScalar(fitDist),
          );
          controls.maxDistance = Math.max(controls.maxDistance, fitDist * 1.4);
          controls.update();
        }

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
            ? "Interactive 3D model of the ZODE steep-gable cabin imported from a CAD asset, shown as a line drawing of the roof, glazing, walls and deck. Drag to rotate; hold Ctrl and scroll to zoom. Use the panel to toggle layers and switch between line and realistic styling."
            : twin
              ? "3D model of two ZODE steep-gable cabins set end-to-end with a gap, joined by an open slatted-deck bridgeway, shown from a fixed top-down isometric angle as a line drawing."
              : "3D model of the ZODE steep-gable cabin imported from a CAD asset, shown from a fixed top-down isometric angle as a line drawing of the roof, glazing, walls and deck."
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
