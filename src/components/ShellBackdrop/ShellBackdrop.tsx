"use client";

import { useEffect, useRef, type ReactElement } from "react";
import * as THREE from "three";
import styles from "./ShellBackdrop.module.css";

/*
 * A fixed, full-viewport WebGL canvas that paints a soft white/gray gradient
 * which drifts slowly underneath the white shell frame. Only the shell chrome
 * (top nav, bottom taskbar, panel edges/corners) is transparent, so the motion
 * reads as a gentle living backdrop around the opaque content panel.
 *
 * Kept intentionally low-contrast and slow. Honors prefers-reduced-motion by
 * rendering a single static frame, and pauses when the tab is hidden.
 */

// Soft white/gray ramp: a bright near-white highlight down to a clearly
// readable cool gray, so the drifting gradient is visible in the thin frame
// without feeling heavy.
const COLOR_LIGHT = new THREE.Color("#eef1f6");
const COLOR_BASE = new THREE.Color("#d8dde5");
const COLOR_SHADE = new THREE.Color("#c1c8d2");

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uLight;
  uniform vec3 uBase;
  uniform vec3 uShade;

  // Cheap value noise + a touch of domain warping for organic, slow motion.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    // Aspect-correct coordinates so the gradient lobe isn't stretched.
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = vUv * aspect;

    float t = uTime * 0.12;

    // Domain warp: drift two low-frequency noise fields against each other so
    // the gradient slowly churns rather than just sliding.
    vec2 warp = vec2(
      noise(p * 1.3 + vec2(t, -t * 0.7)),
      noise(p * 1.1 - vec2(t * 0.8, t))
    );

    float field = noise(p * 1.7 + warp * 1.1 + vec2(t * 0.4, t * 0.6));

    // Broad diagonal gradient (lighter top-right, cooler lower-left), with the
    // animated noise field driving most of the tonal movement so the drift is
    // actually perceptible in the thin shell frame.
    float diag = clamp((vUv.x + (1.0 - vUv.y)) * 0.5, 0.0, 1.0);
    float blend = clamp(diag * 0.4 + field * 0.75 - 0.05, 0.0, 1.0);

    vec3 col = mix(uShade, uBase, smoothstep(0.0, 0.55, blend));
    col = mix(col, uLight, smoothstep(0.5, 1.0, blend));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function ShellBackdrop(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        // When motion is disabled we draw a single frame and stop, so the
        // buffer must be preserved or the lone frame gets cleared after the
        // first composite (leaving only the --shell-outer-bg fallback).
        preserveDrawingBuffer: reduceMotion,
      });
    } catch {
      // No WebGL context: the transparent body falls back to --shell-outer-bg.
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uLight: { value: COLOR_LIGHT.clone() },
      uBase: { value: COLOR_BASE.clone() },
      uShade: { value: COLOR_SHADE.clone() },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // The fullscreen quad bypasses the camera in the vertex shader; without
    // this, three frustum-culls it against the degenerate ortho frustum and
    // nothing is ever drawn.
    mesh.frustumCulled = false;
    scene.add(mesh);

    let frame = 0;
    const start = performance.now();

    const renderFrame = (now: number): void => {
      uniforms.uTime.value = (now - start) / 1000;
      renderer.render(scene, camera);
    };

    const resize = (): void => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      // Repaint immediately so the static (reduced-motion) frame isn't stale.
      if (reduceMotion) {
        renderFrame(performance.now());
      }
    };
    resize();

    const loop = (now: number): void => {
      renderFrame(now);
      frame = window.requestAnimationFrame(loop);
    };

    const onVisibility = (): void => {
      if (reduceMotion) {
        return;
      }
      if (document.hidden) {
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      } else if (!frame) {
        frame = window.requestAnimationFrame(loop);
      }
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduceMotion) {
      renderFrame(performance.now());
    } else {
      frame = window.requestAnimationFrame(loop);
    }

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
