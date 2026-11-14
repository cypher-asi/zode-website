import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Edges, Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useDesign } from "@/features/chassis/store";
import { primaryKey, refKeys, type Ref } from "@/features/chassis/model/refs";
import { EDGE, HOV, INK, PAPER_WHITE, SEL } from "@/features/chassis/drawing/palette";
import styles from "./labels.module.css";

/** Scene units are metres; data is in mm. */
export const M = (mm: number) => mm / 1000;

const PickCtx = createContext({ sel: false, hov: false });

/** 3D counterpart of the SVG `Hit`: click selects, hover highlights, colours follow the shared selection. */
export function Pick({ children, ...ref }: Ref & { children: ReactNode }) {
  const derived = useDesign((s) => s.derived);
  const select = useDesign((s) => s.select);
  const setHover = useDesign((s) => s.setHover);
  const keys = refKeys(ref, derived);
  const sel = useDesign((s) => s.selection != null && keys.includes(s.selection));
  const hov = useDesign((s) => s.hover != null && keys.includes(s.hover));
  const key = primaryKey(ref);
  if (!key) return <>{children}</>;
  return (
    <PickCtx.Provider value={{ sel, hov }}>
      <group
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          select(key);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(key);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = "";
        }}
      >
        {children}
      </group>
    </PickCtx.Provider>
  );
}

export function Mat({ color, opacity = 1, edges = true }: { color: string; opacity?: number; edges?: boolean }) {
  const { sel, hov } = useContext(PickCtx);
  const c = sel ? SEL : hov ? HOV : color;
  return (
    <>
      <meshStandardMaterial
        color={c}
        transparent={opacity < 1}
        opacity={sel || hov ? Math.max(opacity, 0.85) : opacity}
        depthWrite={opacity >= 1}
        roughness={0.85}
      />
      {edges && <Edges color={sel ? SEL : EDGE} threshold={20} />}
    </>
  );
}

/** Axis-aligned box from min corner + size, all in mm. */
export function BoxMM({
  x,
  y,
  z,
  w,
  h,
  d,
  color,
  opacity,
  edges,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  opacity?: number;
  edges?: boolean;
}) {
  return (
    <mesh position={[M(x + w / 2), M(y + h / 2), M(z + d / 2)]}>
      <boxGeometry args={[M(w), M(h), M(d)]} />
      <Mat color={color} opacity={opacity} edges={edges} />
    </mesh>
  );
}

/** Cylinder along X from x0 to x1 (mm), centred at (y, z). */
export function PipeX({
  x0,
  x1,
  y,
  z,
  od,
  color,
}: {
  x0: number;
  x1: number;
  y: number;
  z: number;
  od: number;
  color: string;
}) {
  return (
    <mesh position={[M((x0 + x1) / 2), M(y), M(z)]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[M(od / 2), M(od / 2), M(x1 - x0), 20]} />
      <Mat color={color} edges={false} />
    </mesh>
  );
}

/** Labels sit on the sheet's paper, so they take its ink in either portal theme. */
const ON_PAPER = { pointerEvents: "none", color: INK, "--paper": PAPER_WHITE } as CSSProperties;

export function Marker({ position, n }: { position: [number, number, number]; n: number | string }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={ON_PAPER}>
      <div className={styles.marker}>{n}</div>
    </Html>
  );
}

export function Tag({
  position,
  children,
  variant = "label",
}: {
  position: [number, number, number];
  children: ReactNode;
  variant?: "label" | "pod" | "podName" | "dim" | "equipment";
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={ON_PAPER}>
      <div className={styles[variant]}>{children}</div>
    </Html>
  );
}

export { COLORS } from "./colors";
