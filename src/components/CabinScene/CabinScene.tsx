"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./CabinScene.module.css";

/*
 * Shaded dusk model of the black gabled cabin (1 scene unit = 1 foot):
 *   - 60 long (Z), 20 wide (X), 24 tall (Y); 12 ft walls + 12 ft gable roof.
 *   - Black vertical board-clad walls, dark standing-seam gable roof with
 *     eave/gable overhangs, a slender flue, warm glowing slot windows + door,
 *     and a fully glazed front gable end with a warm timber gable above.
 */
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
    new THREE.Float32BufferAttribute(
      [...a, ...b, ...c, ...d],
      3,
    ),
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
    scene.background = new THREE.Color(0x0e1014);
    scene.fog = new THREE.Fog(0x0e1014, 70, 180);

    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 1000);
    camera.position.set(46, 17, 54);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- Materials ---
    const matWall = track(
      new THREE.MeshStandardMaterial({
        color: 0x141414,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    const matRoof = track(
      new THREE.MeshStandardMaterial({
        color: 0x202225,
        roughness: 0.45,
        metalness: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    const matFlue = track(
      new THREE.MeshStandardMaterial({
        color: 0x2a2a2c,
        roughness: 0.5,
        metalness: 0.6,
      }),
    );
    const matGlass = track(
      new THREE.MeshStandardMaterial({
        color: 0x241a10,
        emissive: 0xffb877,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    const matTimber = track(
      new THREE.MeshStandardMaterial({
        color: 0x6e4a26,
        emissive: 0x4a2c12,
        emissiveIntensity: 0.55,
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    const matDoor = track(
      new THREE.MeshStandardMaterial({
        color: 0x3a2614,
        emissive: 0xffb066,
        emissiveIntensity: 0.9,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    const matGround = track(
      new THREE.MeshStandardMaterial({
        color: 0x111316,
        roughness: 1.0,
        metalness: 0.0,
      }),
    );
    const matPatio = track(
      new THREE.MeshStandardMaterial({
        color: 0x23262b,
        roughness: 1.0,
        metalness: 0.0,
      }),
    );
    const matSeam = track(new THREE.LineBasicMaterial({ color: 0x33373b }));
    const matBoard = track(new THREE.LineBasicMaterial({ color: 0x000000 }));
    const matMullion = track(new THREE.LineBasicMaterial({ color: 0x120c06 }));

    const cabin = new THREE.Group();

    const addMesh = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      opts?: { cast?: boolean; receive?: boolean },
    ): THREE.Mesh => {
      const m = new THREE.Mesh(track(geo), mat);
      m.castShadow = opts?.cast ?? true;
      m.receiveShadow = opts?.receive ?? false;
      cabin.add(m);
      return m;
    };

    // --- Long walls ---
    addMesh(
      quadGeo(
        [-HW, 0, BACK],
        [-HW, 0, FRONT],
        [-HW, WALL, FRONT],
        [-HW, WALL, BACK],
      ),
      matWall,
    );
    addMesh(
      quadGeo(
        [HW, 0, BACK],
        [HW, 0, FRONT],
        [HW, WALL, FRONT],
        [HW, WALL, BACK],
      ),
      matWall,
    );

    // --- Back gable (solid) ---
    addMesh(
      quadGeo(
        [-HW, 0, BACK],
        [HW, 0, BACK],
        [HW, WALL, BACK],
        [-HW, WALL, BACK],
      ),
      matWall,
    );
    addMesh(
      triGeo([-HW, WALL, BACK], [HW, WALL, BACK], [0, RIDGE, BACK]),
      matWall,
    );

    // --- Front gable: glazed lower wall + timber gable triangle ---
    addMesh(
      quadGeo(
        [-HW, 0, FRONT],
        [HW, 0, FRONT],
        [HW, WALL, FRONT],
        [-HW, WALL, FRONT],
      ),
      matGlass,
      { cast: false },
    );
    addMesh(
      triGeo([-HW, WALL, FRONT], [HW, WALL, FRONT], [0, RIDGE, FRONT]),
      matTimber,
    );

    // --- Roof slopes (with eave + gable overhang) ---
    addMesh(
      quadGeo(
        [-EAVE_X, EAVE_Y, -RAKE],
        [-EAVE_X, EAVE_Y, RAKE],
        [0, RIDGE, RAKE],
        [0, RIDGE, -RAKE],
      ),
      matRoof,
    );
    addMesh(
      quadGeo(
        [EAVE_X, EAVE_Y, -RAKE],
        [EAVE_X, EAVE_Y, RAKE],
        [0, RIDGE, RAKE],
        [0, RIDGE, -RAKE],
      ),
      matRoof,
    );
    // Eave fascia (slim vertical face under each roof edge).
    addMesh(
      quadGeo(
        [-EAVE_X, EAVE_Y, -RAKE],
        [-EAVE_X, EAVE_Y, RAKE],
        [-EAVE_X, EAVE_Y - 0.7, RAKE],
        [-EAVE_X, EAVE_Y - 0.7, -RAKE],
      ),
      matRoof,
    );
    addMesh(
      quadGeo(
        [EAVE_X, EAVE_Y, -RAKE],
        [EAVE_X, EAVE_Y, RAKE],
        [EAVE_X, EAVE_Y - 0.7, RAKE],
        [EAVE_X, EAVE_Y - 0.7, -RAKE],
      ),
      matRoof,
    );

    // --- Flue / chimney ---
    const flueGeo = track(new THREE.CylinderGeometry(0.55, 0.55, 9, 16));
    const flue = new THREE.Mesh(flueGeo, matFlue);
    flue.position.set(-3.5, 23, -6);
    flue.castShadow = true;
    cabin.add(flue);

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
      addMesh(wallWindowGeo(xWin, zc, w, y0, y1), matGlass, { cast: false });
    }
    // Entry door.
    addMesh(wallWindowGeo(xWin, -0.5, 3.4, 0, 7.6), matDoor, { cast: false });

    // A couple of slot windows on the far long wall for depth.
    for (const [zc, w, y0, y1] of [
      [-24, 1.6, 4, 8],
      [4, 2.2, 2, 9],
    ] as ReadonlyArray<[number, number, number, number]>) {
      addMesh(wallWindowGeo(-xWin, zc, w, y0, y1), matGlass, { cast: false });
    }

    // --- Mullions on the front glazing ---
    const mullPos: number[] = [];
    for (const x of [-6, -3, 0, 3, 6]) {
      mullPos.push(x, 0, FRONT + 0.06, x, WALL, FRONT + 0.06);
    }
    mullPos.push(-HW, 6, FRONT + 0.06, HW, 6, FRONT + 0.06);
    const mullGeo = track(new THREE.BufferGeometry());
    mullGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(mullPos, 3),
    );
    cabin.add(new THREE.LineSegments(mullGeo, matMullion));

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
    cabin.add(new THREE.LineSegments(boardGeo, matBoard));

    // --- Standing-seam lines on the roof ---
    const seamPos: number[] = [];
    for (let z = -RAKE + 1.5; z < RAKE; z += 2.4) {
      seamPos.push(-EAVE_X, EAVE_Y, z, 0, RIDGE, z);
      seamPos.push(EAVE_X, EAVE_Y, z, 0, RIDGE, z);
    }
    const seamGeo = track(new THREE.BufferGeometry());
    seamGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(seamPos, 3),
    );
    cabin.add(new THREE.LineSegments(seamGeo, matSeam));

    scene.add(cabin);

    // --- Ground + patio ---
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(400, 400)),
      matGround,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const patio = new THREE.Mesh(
      track(new THREE.PlaneGeometry(70, 34)),
      matPatio,
    );
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(0, 0, FRONT + 12);
    patio.receiveShadow = true;
    scene.add(patio);

    // --- Lighting (dusk) ---
    scene.add(new THREE.HemisphereLight(0x3a4866, 0x07080b, 0.7));
    const moon = new THREE.DirectionalLight(0x8094b8, 0.7);
    moon.position.set(-40, 50, -25);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 200;
    const c = moon.shadow.camera as THREE.OrthographicCamera;
    c.left = -60;
    c.right = 60;
    c.top = 60;
    c.bottom = -60;
    c.updateProjectionMatrix();
    scene.add(moon);

    const warmLights: Array<[Pt, number, number]> = [
      [[0, 7, 26], 70, 55], // front living glow
      [[5, 6, 6], 35, 35], // mid windows
      [[4, 6, -22], 22, 30], // back room
      [[3, 16, 33], 8, 18], // gable wall-wash (soft)
      [[-3, 16, 33], 8, 18],
      [[8.5, 8, -0.5], 16, 14], // door light
    ];
    for (const [pos, intensity, dist] of warmLights) {
      const pl = new THREE.PointLight(0xffa64a, intensity, dist, 2);
      pl.position.set(pos[0], pos[1], pos[2]);
      scene.add(pl);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.5 - 0.04;
    controls.target.set(0, 8, 4);
    controls.update();

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
      aria-label="Interactive 3D model of the black gabled cabin: 60 feet long, 20 feet wide, 24 feet tall, with a glazed front gable end and warm-lit windows at dusk. Drag to rotate."
    />
  );
}
