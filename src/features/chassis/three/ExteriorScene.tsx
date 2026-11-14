import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useDesign } from "@/features/chassis/store";
import { fmt } from "@/features/chassis/model/format";
import type { PodPosition } from "@/features/chassis/model/calc";
import type { DesignData } from "@/features/chassis/model/schema";
import { BoxMM, COLORS, M, Mat, Pick, Tag } from "./common";

function DryCoolerRoof({ x0, data, p }: { x0: number; data: DesignData; p: PodPosition }) {
  const roof = p.roof!;
  const ch = data.pods.chassis;
  const L = ch.length;
  const W = ch.width;
  const y0 = ch.transitHeight;
  const s = roof.stack!;
  const c = roof.coil;
  const fanDia = Number(useDesign((st) => st.derived.partsById.get(roof.fanPart ?? "")?.ratings.fanDia) ?? 800);
  const rise = c ? s.coilHigh - s.coilBottom : 0;
  const tilt = c ? Math.acos(Math.min(1, rise / c.slant)) : 0;
  const run = c ? c.slant * Math.sin(tilt) : 0;
  const post = 100;

  return (
    <group>
      <Pick part="drip-deck">
        <BoxMM x={x0} y={y0} z={0} w={L} h={s.deckTop} d={W} color={COLORS.wall} />
      </Pick>
      <Pick part="cooler-frame">
        {[
          [0, 0],
          [L - post, 0],
          [0, W - post],
          [L - post, W - post],
        ].map(([px, pz]) => (
          <BoxMM
            key={`${px}${pz}`}
            x={x0 + px}
            y={y0 + s.deckTop}
            z={pz}
            w={post}
            h={roof.height - s.deckTop}
            d={post}
            color={COLORS.bus}
          />
        ))}
        <BoxMM
          x={x0}
          y={y0 + s.drainSkin[0]}
          z={0}
          w={L}
          h={s.drainSkin[1] - s.drainSkin[0]}
          d={roof.sideMargin}
          color={COLORS.wall}
        />
        <BoxMM
          x={x0}
          y={y0 + s.drainSkin[0]}
          z={W - roof.sideMargin}
          w={L}
          h={s.drainSkin[1] - s.drainSkin[0]}
          d={roof.sideMargin}
          color={COLORS.wall}
        />
      </Pick>
      {/* Open vertical side intakes */}
      {[0, W - 20].map((z) => (
        <BoxMM
          key={z}
          x={x0 + post}
          y={y0 + s.deckTop}
          z={z}
          w={L - 2 * post}
          h={s.drainSkin[0] - s.deckTop}
          d={20}
          color={COLORS.coil}
          opacity={0.25}
        />
      ))}
      {c && (
        <Pick part="coil-bank">
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[M(x0 + L / 2), M(y0 + (s.coilBottom + s.coilHigh) / 2), M(W / 2 + side * (run / 2 + 120))]}
              rotation={[side * tilt, 0, 0]}
            >
              <boxGeometry args={[M(c.length), M(c.slant), M(c.thick)]} />
              <Mat color={COLORS.coil} />
            </mesh>
          ))}
        </Pick>
      )}
      {Array.from({ length: roof.fanRows * roof.fanCols }, (_, i) => {
        const r = Math.floor(i / roof.fanCols);
        const col = i % roof.fanCols;
        const fx = x0 + roof.endMargin + col * (roof.frame + roof.gap);
        const fz = roof.sideMargin + r * (roof.frame + roof.centerGap);
        return (
          <Pick key={i} part={roof.fanPart}>
            <BoxMM x={fx} y={y0 + s.fanFlange - 20} z={fz} w={roof.frame} h={20} d={roof.frame} color={COLORS.tap} />
            <mesh position={[M(fx + roof.frame / 2), M(y0 + s.fanFlange + 40), M(fz + roof.frame / 2)]}>
              <cylinderGeometry args={[M(roof.nozzleDia / 2), M(roof.nozzleDia / 2), M(80), 28]} />
              <Mat color={COLORS.fan} edges={false} />
            </mesh>
            <mesh position={[M(fx + roof.frame / 2), M(y0 + s.guardTop - 5), M(fz + roof.frame / 2)]}>
              <cylinderGeometry args={[M(fanDia / 2), M(fanDia / 2), M(10), 28]} />
              <Mat color={COLORS.spare} opacity={0.35} edges={false} />
            </mesh>
          </Pick>
        );
      })}
    </group>
  );
}

export function Row() {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const ch = data.pods.chassis;
  const L = ch.length;
  const W = ch.width;
  const T = ch.transitHeight;
  /** Plan y (mm from the front face) -> world z (front faces +z). */
  const Z = (y: number) => W - y;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[M(d.geometry.rowLength / 2), -0.002, M(Z(3000))]}>
        <planeGeometry args={[M(d.geometry.rowLength) + 14, 22]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>

      {d.pods.map((p) => {
        const roofKit = p.roof?.kits[0]?.part;
        const panels = p.pod.servicePanelsPerFace;
        const panelW = panels ? (L - 300 - (panels - 1) * 40) / panels : 0;
        return (
          <group key={p.pod.id}>
            <Pick bom={p.pod.shellBom}>
              <BoxMM x={p.x} y={0} z={0} w={L} h={T} d={W} color={COLORS.shell} />
              {Array.from({ length: panels }, (_, i) => (
                <BoxMM
                  key={i}
                  x={p.x + 150 + i * (panelW + 40)}
                  y={250}
                  z={W}
                  w={panelW}
                  h={T - 500}
                  d={12}
                  color={COLORS.wall}
                />
              ))}
            </Pick>
            {p.roof?.type === "dry-cooler" ? (
              <DryCoolerRoof x0={p.x} data={data} p={p} />
            ) : p.roof ? (
              <Pick part={roofKit}>
                <BoxMM x={p.x} y={T} z={0} w={L} h={p.roof.height} d={W} color={COLORS.patch} />
              </Pick>
            ) : null}
            <Tag
              position={[M(p.x + L / 2), M(T + (p.roof?.height ?? 0)) + 0.55, M(W / 2)]}
              variant="pod"
            >
              <div>{p.pod.roof.label}</div>
              <div>{p.pod.roof.sub}</div>
            </Tag>
            <Tag
              position={[M(p.x + L / 2), M(T / 2), M(W) + 0.05]}
              variant="podName"
            >
              {p.pod.short}
            </Tag>
            <Tag
              position={[M(p.x + L / 2), -0.25, M(W) + 0.6]}
              variant="dim"
            >
              {`${fmt(L)} mm / ${ch.nominal} nominal`}
            </Tag>
          </group>
        );
      })}

      {data.site.equipment.map((e) => (
        <Pick key={e.id} bom={e.bom}>
          <BoxMM x={e.x} y={0} z={Z(e.y + e.w)} w={e.l} h={e.h} d={e.w} color={COLORS.patch} />
          {Array.from({ length: e.fans }, (_, i) => {
            const pitch = e.l / e.fans;
            return (
              <mesh key={i} position={[M(e.x + pitch * (i + 0.5)), M(e.h) + 0.02, M(Z(e.y + e.w / 2))]}>
                <cylinderGeometry args={[M(Math.min(pitch, e.w) * 0.38), M(Math.min(pitch, e.w) * 0.38), 0.04, 24]} />
                <Mat color={COLORS.fan} edges={false} />
              </mesh>
            );
          })}
          <Tag
            position={[M(e.x + e.l / 2), M(e.h) + 0.35, M(Z(e.y + e.w / 2))]}
            variant="equipment"
          >
            {e.label}
          </Tag>
        </Pick>
      ))}
    </group>
  );
}

export default function ExteriorScene() {
  const rowLength = useDesign((s) => s.derived.geometry.rowLength);
  const select = useDesign((s) => s.select);
  const cx = M(rowLength) / 2;
  return (
    <Canvas
      camera={{ position: [cx - 9, 11, 17], fov: 36, near: 0.1, far: 400 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={() => select(null)}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[cx - 10, 18, 14]} intensity={1.5} />
      <directionalLight position={[cx + 12, 6, -10]} intensity={0.35} />
      <Row />
      <OrbitControls makeDefault target={[cx, 2.2, 0]} enableDamping={false} />
    </Canvas>
  );
}
