import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useDesign } from "@/features/chassis/store";
import { railLayout } from "@/features/chassis/model/layout";
import { BoxMM, COLORS, M, Marker, Pick, PipeX, Tag } from "./common";

export function Interior() {
  const data = useDesign((s) => s.data);
  const d = useDesign((s) => s.derived);
  const ch = data.pods.chassis;
  const bay = data.racks.bay;
  const sec = data.racks.section;
  const { wall, clearL } = d.geometry;
  const L = ch.length;
  const W = ch.width;
  const H = d.geometry.deployedHeight;
  const floor = ch.floorBuildUp;
  const baseOff = (bay.height - bay.units * bay.unitHeight) / 2;
  /** Across-pod position (mm from inner front wall) -> world z (front faces +z). */
  const Z = (y: number) => W - wall - y;
  const pod = data.pods.pods.find((p) => p.id === "compute");
  const rails = railLayout(data, d);
  const runX0 = wall + bay.endClearance;
  const runX1 = wall + clearL - bay.endClearance;
  const a0 = bay.frontZone;
  const a1 = bay.frontZone + bay.depth;
  const last = d.racks.at(-1);
  const firstCentral = d.racks.find((r) => r.type.role === "central");
  const lastCompute = [...d.racks].reverse().find((r) => r.type.role === "compute");

  return (
    <group>
      {/* Shell cut-away: floor, rear wall and end walls only. */}
      <Pick bom={pod?.shellBom}>
        <BoxMM x={0} y={0} z={0} w={L} h={floor} d={W} color={COLORS.floor} />
        <BoxMM x={0} y={0} z={0} w={L} h={H} d={wall} color={COLORS.wall} opacity={0.35} />
        <BoxMM x={0} y={0} z={0} w={wall} h={H} d={W} color={COLORS.wall} opacity={0.25} />
        <BoxMM x={L - wall} y={0} z={0} w={wall} h={H} d={W} color={COLORS.wall} opacity={0.25} />
      </Pick>

      {d.racks.map((r) => {
        const x0 = wall + r.x;
        const central = r.type.role === "central";
        return (
          <group key={r.id}>
            <Pick rack={r.id}>
              <BoxMM
                x={x0}
                y={floor}
                z={Z(a1)}
                w={bay.pitch}
                h={bay.height}
                d={bay.depth}
                color={central ? COLORS.rackCentral : COLORS.rack}
                opacity={0.14}
              />
            </Pick>
            {r.type.slots.map((s) => {
              const dims = s.part ? d.partsById.get(s.part)?.dims : null;
              const bw = dims?.w ?? bay.equipmentFace;
              const bd = dims?.d ?? 600;
              return (
                <Pick key={s.uStart} part={s.part} rack={s.part ? undefined : r.id}>
                  <BoxMM
                    x={x0 + (bay.pitch - bw) / 2}
                    y={floor + baseOff + (s.uStart - 1) * bay.unitHeight + 1.5}
                    z={Z(a0 + bay.frontOffset + bd)}
                    w={bw}
                    h={s.uHeight * bay.unitHeight - 3}
                    d={bd}
                    color={COLORS[s.kind]}
                  />
                </Pick>
              );
            })}
            {r.type.zeroU.map((z, i) => (
              <Pick key={z.id} part={z.part}>
                <BoxMM
                  x={i === 0 ? x0 + bay.sideFrame : x0 + bay.pitch - bay.sideFrame - bay.zeroUZone.w}
                  y={floor + 100}
                  z={Z(a1)}
                  w={bay.zeroUZone.w}
                  h={bay.zeroUZone.h}
                  d={bay.zeroUZone.d}
                  color={COLORS.pdu}
                />
              </Pick>
            ))}
            <Pick part={r.type.rdhx}>
              <BoxMM
                x={x0}
                y={floor}
                z={Z(a1 + bay.rdhxDepth)}
                w={bay.pitch}
                h={bay.height}
                d={bay.rdhxDepth}
                color={COLORS.rdhx}
                opacity={0.75}
              />
            </Pick>
            <Tag position={[M(x0 + bay.pitch / 2), M(floor) - 0.15, M(Z(a0)) + 0.25]}>{r.id}</Tag>
          </group>
        );
      })}

      {/* Overhead services */}
      <Pick bom="E5">
        {rails.map((rail) => {
          const b = rail.id === "A" ? sec.busA : sec.busB;
          const xs = rail.items.map((it) => wall + it.x);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...rail.items.map((it) => wall + it.x + it.l));
          return (
            <BoxMM
              key={rail.id}
              x={x0}
              y={floor + b.z[0]}
              z={Z(b.y + b.w / 2)}
              w={x1 - x0}
              h={b.z[1] - b.z[0]}
              d={b.w}
              color={COLORS.bus}
            />
          );
        })}
      </Pick>
      {rails.map((rail) =>
        rail.items.map((it) =>
          it.kind === "tap" ? (
            <Pick key={`${rail.id}${it.label}`} part="busway-tap">
              <BoxMM
                x={wall + it.x}
                y={floor + sec.tap.z[0]}
                z={Z(rail.y + sec.tap.w / 2)}
                w={it.l}
                h={sec.tap.h}
                d={sec.tap.w}
                color={COLORS.tap}
              />
            </Pick>
          ) : (
            <Pick key={`${rail.id}feed`} part="busway-end-feed">
              <BoxMM
                x={wall + it.x}
                y={floor + sec.feed.z[0]}
                z={Z(rail.y + sec.feed.w / 2)}
                w={it.l}
                h={sec.feed.h}
                d={sec.feed.w}
                color={COLORS.pdu}
              />
            </Pick>
          ),
        ),
      )}
      <Pick bom="B3">
        {sec.fiber.trays.map(([z0, z1]) => (
          <BoxMM
            key={z0}
            x={runX0}
            y={floor + z0}
            z={Z(sec.fiber.y[1])}
            w={runX1 - runX0}
            h={z1 - z0}
            d={sec.fiber.y[1] - sec.fiber.y[0]}
            color={COLORS.fiber}
          />
        ))}
      </Pick>
      <Pick bom="B8">
        {sec.wHeader.z.map((z) => (
          <PipeX
            key={z}
            x0={runX0}
            x1={runX1}
            y={floor + z}
            z={Z(sec.wHeader.y)}
            od={sec.wHeader.od}
            color={COLORS.wHeader}
          />
        ))}
      </Pick>
      <Pick bom="M7">
        {sec.cHeader.z.map((z) => (
          <PipeX
            key={z}
            x0={runX0}
            x1={runX1}
            y={floor + z}
            z={Z(sec.cHeader.y)}
            od={sec.cHeader.od}
            color={COLORS.cHeader}
          />
        ))}
      </Pick>
      <Pick bom="C2">
        <BoxMM
          x={runX0}
          y={floor + sec.leakTray.z[0]}
          z={Z(sec.leakTray.y[1])}
          w={runX1 - runX0}
          h={sec.leakTray.z[1] - sec.leakTray.z[0]}
          d={sec.leakTray.y[1] - sec.leakTray.y[0]}
          color={COLORS.leak}
        />
      </Pick>

      {/* Numbered callouts keyed to the sheet notes */}
      <Marker
        n={1}
        position={[
          M(runX1 - 300),
          M(floor + sec.fiber.trays[1][1]) + 0.12,
          M(Z((sec.fiber.y[0] + sec.fiber.y[1]) / 2)),
        ]}
      />
      <Marker n={2} position={[M(runX1 - 250), M(floor + sec.wHeader.z[1]) + 0.15, M(Z(sec.wHeader.y))]} />
      <Marker n={3} position={[M(runX1 - 700), M(floor + sec.busA.z[1]) + 0.12, M(Z(sec.busA.y))]} />
      {last && (
        <Marker n={4} position={[M(wall + last.x + bay.pitch - 40), M(floor + bay.height * 0.6), M(Z(a1 - 75))]} />
      )}
      {last && (
        <Marker
          n={5}
          position={[M(wall + last.x + bay.pitch / 2), M(floor + bay.height) + 0.1, M(Z(a1 + bay.rdhxDepth / 2))]}
        />
      )}
      {firstCentral && (
        <Marker
          n={6}
          position={[M(wall + firstCentral.x + bay.pitch / 2), M(floor + bay.height * 0.7), M(Z(a0)) + 0.05]}
        />
      )}
      {lastCompute && (
        <Marker
          n={7}
          position={[M(wall + lastCompute.x + bay.pitch / 2), M(floor + baseOff + 2 * bay.unitHeight), M(Z(a0)) + 0.05]}
        />
      )}
    </group>
  );
}

export default function ComputeInteriorScene() {
  const W = useDesign((s) => s.data.pods.chassis.width);
  const L = useDesign((s) => s.data.pods.chassis.length);
  const select = useDesign((s) => s.select);
  return (
    <Canvas
      camera={{ position: [M(L) * 0.08, 5.2, M(W) + 5.2], fov: 38, near: 0.05, far: 200 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={() => select(null)}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 8, 6]} intensity={1.4} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
      <Interior />
      <OrbitControls makeDefault target={[M(L) * 0.5, 1.4, M(W) * 0.45]} enableDamping={false} />
    </Canvas>
  );
}
