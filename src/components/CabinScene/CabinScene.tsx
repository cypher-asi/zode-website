"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./CabinScene.module.css";

/*
 * Dimensions in feet (1 scene unit = 1 foot):
 *   - 60 long (Z), 20 wide (X), 24 tall (Y)
 *   - 12 ft vertical walls + 12 ft gable roof (ridge at 24)
 *   - The front 16 ft is an open, recessed deck that sits *inside* the shell:
 *     the roof spans the full 60 ft, but the front wall is pulled back to
 *     z = DECK_FRONT, leaving corner posts and an open gable over the deck.
 */
const HALF_W = 10; // 20 ft wide
const WALL = 12; // eave height
const RIDGE = 24; // ridge height
const BACK = -30; // rear gable
const FRONT = 30; // open front edge of the deck/roof
const DECK_FRONT = 14; // glazed wall separating interior from the 16 ft deck

const STRUCTURE_COLOR = 0xe8e2d8;
const GLASS_COLOR = 0xe0a93b;

type Pt = readonly [number, number, number];

/** Push both endpoints of a segment into a flat position array. */
function seg(out: number[], a: Pt, b: Pt): void {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** The five profile points of the house cross-section at a given z. */
function profile(z: number) {
  return {
    bl: [-HALF_W, 0, z] as Pt,
    br: [HALF_W, 0, z] as Pt,
    el: [-HALF_W, WALL, z] as Pt,
    er: [HALF_W, WALL, z] as Pt,
    rg: [0, RIDGE, z] as Pt,
  };
}

/** Closed pentagon (walls + gable triangle) at a given z. */
function gable(out: number[], z: number): void {
  const p = profile(z);
  seg(out, p.bl, p.br);
  seg(out, p.br, p.er);
  seg(out, p.er, p.rg);
  seg(out, p.rg, p.el);
  seg(out, p.el, p.bl);
}

function buildStructure(): number[] {
  const v: number[] = [];
  const back = profile(BACK);
  const front = profile(FRONT);
  const deck = profile(DECK_FRONT);

  // Longitudinal lines spanning the full 60 ft shell.
  seg(v, back.rg, front.rg); // ridge
  seg(v, back.el, front.el); // left eave
  seg(v, back.er, front.er); // right eave
  seg(v, back.bl, front.bl); // left sill / footprint
  seg(v, back.br, front.br); // right sill / footprint

  // Rear gable: fully enclosed wall.
  gable(v, BACK);

  // Open front: roof gable + corner posts over the deck (no bottom wall).
  seg(v, front.el, front.rg);
  seg(v, front.rg, front.er);
  seg(v, front.el, front.er); // eave tie beam
  seg(v, front.bl, front.el); // left corner post
  seg(v, front.br, front.er); // right corner post

  // Deck floor outline (the 16 ft recess).
  seg(v, deck.bl, front.bl);
  seg(v, deck.br, front.br);
  seg(v, front.bl, front.br);
  seg(v, deck.bl, deck.br);

  // Windows along both long walls of the enclosed portion.
  const windowZs = [-24, -16, -8, 0, 8];
  for (const z0 of windowZs) {
    const z1 = z0 + 4;
    for (const x of [-HALF_W, HALF_W]) {
      const yLo = 2.5;
      const yHi = 9;
      seg(v, [x, yLo, z0], [x, yLo, z1]);
      seg(v, [x, yHi, z0], [x, yHi, z1]);
      seg(v, [x, yLo, z0], [x, yHi, z0]);
      seg(v, [x, yLo, z1], [x, yHi, z1]);
    }
  }

  // Entry door on the left wall.
  seg(v, [-HALF_W, 0, -3], [-HALF_W, 7.5, -3]);
  seg(v, [-HALF_W, 0, 1], [-HALF_W, 7.5, 1]);
  seg(v, [-HALF_W, 7.5, -3], [-HALF_W, 7.5, 1]);

  return v;
}

function buildGlazing(): number[] {
  const v: number[] = [];
  // Glazed front wall (pentagon) at the interior/deck boundary.
  gable(v, DECK_FRONT);

  const p = profile(DECK_FRONT);
  // Vertical mullions.
  for (const x of [-5, 0, 5]) {
    seg(v, [x, 0, DECK_FRONT], [x, WALL, DECK_FRONT]);
  }
  // Horizontal transom at eave height.
  seg(v, p.el, p.er);
  // Gable glazing follows the roof slope.
  seg(v, [0, WALL, DECK_FRONT], p.rg);
  return v;
}

function makeLines(positions: number[], color: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.LineSegments(geometry, material);
}

/**
 * Interactive, line-drawn model of the A-frame cabin. All WebGL work runs
 * inside the effect so the component is safe to render on the server.
 */
export function CabinScene(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(52, 30, 62);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const cabin = new THREE.Group();
    cabin.add(makeLines(buildStructure(), STRUCTURE_COLOR));
    cabin.add(makeLines(buildGlazing(), GLASS_COLOR));
    // Center vertically around the wall midline for a balanced framing.
    cabin.position.y = -9;
    scene.add(cabin);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.5 - 0.05;
    controls.target.set(0, 2, 0);
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
      scene.traverse((object) => {
        if (object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
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
      aria-label="Interactive 3D line model of the A-frame cabin: 60 feet long, 20 feet wide, 24 feet tall, with a recessed front deck. Drag to rotate."
    />
  );
}
