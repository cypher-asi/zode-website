"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./CabinScene.module.css";

/*
 * Hidden-line drawing of the black gabled cabin (1 scene unit = 1 foot):
 *   - 60 long (Z), 20 wide (X), 24 tall (Y); 12 ft walls + 12 ft gable roof.
 *   - Every solid is filled with the flat charcoal background so it occludes,
 *     then outlined with thin white edge lines. The result reads like a 3D
 *     architectural line drawing: depth and detail (board cladding, standing
 *     seams, mullions, flue) without any shading, glow, or fog.
 *   - A raised deck with step blocks and a dining set sit out front.
 */
const BG = 0x2b2b2b; // flat charcoal backdrop
const LINE = 0xeaeaea; // white drawing lines

const HW = 10; // half width (20 ft)
const WALL = 12; // eave height
const RIDGE = 24; // ridge height
const BACK = -30;
const FRONT = 30;
const EAVE_X = 11.2; // roof eave incl. overhang
const EAVE_Y = 10.56; // roof eave height incl. overhang
const RAKE = 31.4; // roof end incl. gable overhang

type Pt = readonly [number, number, number];

function quadGeo(a: Pt, b: Pt, c: Pt, d: Pt): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

function triGeo(a: Pt, b: Pt, c: Pt): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([...a, ...b, ...c], 3),
  );
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  return g;
}

/** Vertical rectangle on a long wall (constant x), facing outward. */
function wallWindowGeo(
  x: number,
  zc: number,
  w: number,
  y0: number,
  y1: number,
): THREE.BufferGeometry {
  const z0 = zc - w / 2;
  const z1 = zc + w / 2;
  return quadGeo([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]);
}

export function CabinScene(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const track = <T extends THREE.BufferGeometry | THREE.Material>(o: T): T => {
      if (o instanceof THREE.BufferGeometry) geometries.push(o);
      else materials.push(o);
      return o;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);

    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 1000);
    camera.position.set(46, 17, 54);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // --- Materials ---
    // Opaque charcoal fill, nudged back so it occludes far edges (hidden-line
    // look) without z-fighting the white outlines drawn on top.
    const matFill = track(
      new THREE.MeshBasicMaterial({
        color: BG,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    const matLine = track(new THREE.LineBasicMaterial({ color: LINE }));

    const cabin = new THREE.Group();

    /** Fill a geometry with charcoal and outline its edges in white. */
    const addSolid = (geo: THREE.BufferGeometry): void => {
      cabin.add(new THREE.Mesh(track(geo), matFill));
      cabin.add(
        new THREE.LineSegments(track(new THREE.EdgesGeometry(geo, 1)), matLine),
      );
    };

    /** Axis-aligned box solid centered at (cx, cy, cz). */
    const addBox = (
      sx: number,
      sy: number,
      sz: number,
      cx: number,
      cy: number,
      cz: number,
    ): void => {
      const geo = track(new THREE.BoxGeometry(sx, sy, sz));
      const mesh = new THREE.Mesh(geo, matFill);
      mesh.position.set(cx, cy, cz);
      cabin.add(mesh);
      const edges = new THREE.LineSegments(
        track(new THREE.EdgesGeometry(geo, 1)),
        matLine,
      );
      edges.position.set(cx, cy, cz);
      cabin.add(edges);
    };

    // --- Long walls ---
    addSolid(
      quadGeo(
        [-HW, 0, BACK],
        [-HW, 0, FRONT],
        [-HW, WALL, FRONT],
        [-HW, WALL, BACK],
      ),
    );
    addSolid(
      quadGeo([HW, 0, BACK], [HW, 0, FRONT], [HW, WALL, FRONT], [HW, WALL, BACK]),
    );

    // --- Back gable (solid) ---
    addSolid(
      quadGeo(
        [-HW, 0, BACK],
        [HW, 0, BACK],
        [HW, WALL, BACK],
        [-HW, WALL, BACK],
      ),
    );
    addSolid(triGeo([-HW, WALL, BACK], [HW, WALL, BACK], [0, RIDGE, BACK]));

    // --- Front gable: glazed lower wall + gable triangle ---
    addSolid(
      quadGeo(
        [-HW, 0, FRONT],
        [HW, 0, FRONT],
        [HW, WALL, FRONT],
        [-HW, WALL, FRONT],
      ),
    );
    addSolid(triGeo([-HW, WALL, FRONT], [HW, WALL, FRONT], [0, RIDGE, FRONT]));

    // --- Roof slopes (with eave + gable overhang) ---
    addSolid(
      quadGeo(
        [-EAVE_X, EAVE_Y, -RAKE],
        [-EAVE_X, EAVE_Y, RAKE],
        [0, RIDGE, RAKE],
        [0, RIDGE, -RAKE],
      ),
    );
    addSolid(
      quadGeo(
        [EAVE_X, EAVE_Y, -RAKE],
        [EAVE_X, EAVE_Y, RAKE],
        [0, RIDGE, RAKE],
        [0, RIDGE, -RAKE],
      ),
    );
    // Eave fascia (slim vertical face under each roof edge).
    addSolid(
      quadGeo(
        [-EAVE_X, EAVE_Y, -RAKE],
        [-EAVE_X, EAVE_Y, RAKE],
        [-EAVE_X, EAVE_Y - 0.7, RAKE],
        [-EAVE_X, EAVE_Y - 0.7, -RAKE],
      ),
    );
    addSolid(
      quadGeo(
        [EAVE_X, EAVE_Y, -RAKE],
        [EAVE_X, EAVE_Y, RAKE],
        [EAVE_X, EAVE_Y - 0.7, RAKE],
        [EAVE_X, EAVE_Y - 0.7, -RAKE],
      ),
    );

    // --- Flue / chimney ---
    {
      const geo = track(new THREE.CylinderGeometry(0.55, 0.55, 9, 16));
      const mesh = new THREE.Mesh(geo, matFill);
      mesh.position.set(-3.5, 23, -6);
      cabin.add(mesh);
      const edges = new THREE.LineSegments(
        track(new THREE.EdgesGeometry(geo, 1)),
        matLine,
      );
      edges.position.set(-3.5, 23, -6);
      cabin.add(edges);
    }

    // --- Windows + door on the camera-facing long wall (+X) ---
    const xWin = HW + 0.04;
    const windows: ReadonlyArray<[number, number, number, number]> = [
      [-24, 1.6, 4, 8],
      [4, 2.2, 2, 9],
      [8, 2.2, 2, 9],
      [14, 4, 1.5, 9.2],
      [23.5, 11, 0.4, 11], // wraparound living glazing near front
    ];
    for (const [zc, w, y0, y1] of windows) {
      addSolid(wallWindowGeo(xWin, zc, w, y0, y1));
    }
    // Entry door.
    addSolid(wallWindowGeo(xWin, -0.5, 3.4, 0, 7.6));

    // A couple of slot windows on the far long wall for depth.
    for (const [zc, w, y0, y1] of [
      [-24, 1.6, 4, 8],
      [4, 2.2, 2, 9],
    ] as ReadonlyArray<[number, number, number, number]>) {
      addSolid(wallWindowGeo(-xWin, zc, w, y0, y1));
    }

    // --- Mullions on the front glazing ---
    const mullPos: number[] = [];
    for (const x of [-6, -3, 0, 3, 6]) {
      mullPos.push(x, 0, FRONT + 0.06, x, WALL, FRONT + 0.06);
    }
    mullPos.push(-HW, 6, FRONT + 0.06, HW, 6, FRONT + 0.06);
    const mullGeo = track(new THREE.BufferGeometry());
    mullGeo.setAttribute("position", new THREE.Float32BufferAttribute(mullPos, 3));
    cabin.add(new THREE.LineSegments(mullGeo, matLine));

    // --- Vertical board cladding lines on the long walls ---
    const boardPos: number[] = [];
    for (let z = BACK + 1; z < FRONT; z += 1.25) {
      boardPos.push(-HW - 0.02, 0, z, -HW - 0.02, WALL, z);
      boardPos.push(HW + 0.02, 0, z, HW + 0.02, WALL, z);
    }
    const boardGeo = track(new THREE.BufferGeometry());
    boardGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(boardPos, 3),
    );
    cabin.add(new THREE.LineSegments(boardGeo, matLine));

    // --- Standing-seam lines on the roof ---
    const seamPos: number[] = [];
    for (let z = -RAKE + 1.5; z < RAKE; z += 2.4) {
      seamPos.push(-EAVE_X, EAVE_Y, z, 0, RIDGE, z);
      seamPos.push(EAVE_X, EAVE_Y, z, 0, RIDGE, z);
    }
    const seamGeo = track(new THREE.BufferGeometry());
    seamGeo.setAttribute("position", new THREE.Float32BufferAttribute(seamPos, 3));
    cabin.add(new THREE.LineSegments(seamGeo, matLine));

    // --- Raised deck + step blocks ---
    const DECK_TOP = 0; // deck surface at grade reference
    const DECK_T = 1.2; // slab thickness
    // Main slab spans under the cabin and out front.
    addBox(72, DECK_T, 84, 0, DECK_TOP - DECK_T / 2, 12);
    // Wide low step off the front-left end.
    addBox(16, DECK_T * 0.7, 9, -22, DECK_TOP - DECK_T - DECK_T * 0.35, FRONT + 24);
    // Smaller step block off the front-right end.
    addBox(10, DECK_T * 0.7, 6, 22, DECK_TOP - DECK_T - DECK_T * 0.35, FRONT + 24);

    // --- Dining table + chairs (front-right of the deck) ---
    {
      const tx = 9; // table center X
      const tz = FRONT + 11; // table center Z (out on the deck)
      const tableTopY = 2.4;
      const legY = tableTopY - 1.1;
      addBox(6, 0.25, 3, tx, tableTopY, tz); // table top
      const legDX = 2.6;
      const legDZ = 1.1;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addBox(0.2, 2.2, 0.2, tx + sx * legDX, legY, tz + sz * legDZ);
        }
      }
      // Chairs: seat + back, three per long side.
      const seatY = 1.4;
      for (const side of [-1, 1]) {
        for (const off of [-1.9, 0, 1.9]) {
          const cx = tx + side * 2.6;
          const cz = tz + off;
          addBox(1.1, 0.18, 1.1, cx, seatY, cz); // seat
          addBox(1.1, 1.5, 0.16, cx + side * 0.45, seatY + 0.75, cz); // back
        }
      }
    }

    scene.add(cabin);

    // --- Lighting ---
    // Unlit (MeshBasic / line) materials need no scene lights, but a faint
    // ambient keeps things future-proof if any lit material is added.
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // toggled on only while Ctrl is held
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 30;
    controls.maxDistance = 120;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.5 - 0.04;
    controls.target.set(0, 8, 4);
    controls.update();

    // Ctrl + wheel zooms the scene; a plain wheel falls through to the page so
    // deck navigation still works. The capture-phase listener runs before
    // OrbitControls' own handler, so the flag is correct when it reads it.
    const onWheelCapture = (event: WheelEvent) => {
      controls.enableZoom = event.ctrlKey;
    };
    container.addEventListener("wheel", onWheelCapture, {
      capture: true,
      passive: true,
    });

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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("wheel", onWheelCapture, { capture: true });
      controls.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.scene}
      role="img"
      aria-label="Interactive 3D line drawing of the black gabled cabin: 60 feet long, 20 feet wide, 24 feet tall, rendered as thin white outlines on charcoal, with board cladding, a standing-seam roof, a glazed front gable, and a raised deck with a dining table and chairs. Drag to rotate; hold Ctrl and scroll to zoom."
    />
  );
}
