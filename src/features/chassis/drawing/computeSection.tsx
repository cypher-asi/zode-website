import type { DesignData } from "@/features/chassis/model/schema";
import type { Derived } from "@/features/chassis/model/calc";
import { fmt } from "@/features/chassis/model/format";
import { Box, Circle, DASH, Hit, Line, LW, TextBlock, Txt } from "./core";

/**
 * Compute-pod cross-section (looking along the row) in real mm.
 * x = across-pod position from the outer face; y = deployedHeight - z.
 * The section is cropped below `zMin`.
 */
export function ComputeSection({
  data,
  d,
  zMin = 2000,
  labels = true,
}: {
  data: DesignData;
  d: Derived;
  zMin?: number;
  labels?: boolean;
}) {
  const ch = data.pods.chassis;
  const bay = data.racks.bay;
  const sec = data.racks.section;
  const H = d.geometry.deployedHeight;
  const W = ch.width;
  const wall = d.geometry.wall;
  const Y = (z: number) => H - z;
  const X = (y: number) => wall + y;
  const ceil = ch.flatCeiling;
  const buses = [
    { id: "A", ...sec.busA },
    { id: "B", ...sec.busB },
  ];

  return (
    <g>
      <Hit bom="S8">
        <Box x={0} y={0} w={W} h={H - zMin} fill="light" sw={LW.thick} />
        <Box x={wall} y={Y(ceil)} w={W - 2 * wall} h={ceil - zMin} fill="white" sw={LW.med} />
      </Hit>
      <Line x1={-80} y1={Y(zMin)} x2={W + 80} y2={Y(zMin)} sw={LW.hair} dash={DASH.dashdot} />

      {/* rack tops */}
      <Hit part={data.racks.types[0]?.frame}>
        <Box
          x={X(bay.frontZone)}
          y={Y(bay.height)}
          w={bay.depth}
          h={bay.height - zMin}
          fill="white"
          sw={LW.med}
          label={labels ? [`RACK TOP ${fmt(bay.height)}`] : []}
          labelSize={1.1}
        />
      </Hit>

      {buses.map((b) => (
        <g key={b.id}>
          <Line x1={X(b.y)} y1={Y(ceil)} x2={X(b.y)} y2={Y(b.z[1])} sw={LW.hair} />
          <Hit bom="E5">
            <Box x={X(b.y) - b.w / 2} y={Y(b.z[1])} w={b.w} h={b.z[1] - b.z[0]} fill="dark" sw={LW.med} />
          </Hit>
          <Hit part="busway-tap">
            <Box
              x={X(b.y) - sec.tap.w / 2}
              y={Y(sec.tap.z[1])}
              w={sec.tap.w}
              h={sec.tap.z[1] - sec.tap.z[0]}
              fill="white"
              sw={LW.med}
              label={labels ? [b.id] : []}
              labelSize={1.2}
            />
            <Box
              x={X(b.y) - sec.tap.w / 2}
              y={Y(sec.tap.z[0])}
              w={sec.tap.w}
              h={sec.tap.z[0] - sec.tap.withdrawal}
              fill="none"
              dash={DASH.fine}
              sw={LW.thin}
            />
          </Hit>
        </g>
      ))}

      <Hit bom="B3">
        {sec.fiber.trays.map(([z0, z1]) => (
          <Box
            key={z0}
            x={X(sec.fiber.y[0])}
            y={Y(z1)}
            w={sec.fiber.y[1] - sec.fiber.y[0]}
            h={z1 - z0}
            fill="light"
            sw={LW.med}
          />
        ))}
      </Hit>
      {labels && (
        <Txt
          x={X((sec.fiber.y[0] + sec.fiber.y[1]) / 2)}
          y={Y(Math.max(...sec.fiber.trays.map((t) => t[1]))) - 250}
          size={1.1}
          anchor="middle"
          bold
        >
          FIBER
        </Txt>
      )}

      {[
        { h: sec.wHeader, id: "W", bom: "B8" },
        { h: sec.cHeader, id: "C", bom: "M7" },
      ].map(({ h, id, bom }) => (
        <Hit key={id} bom={bom}>
          {h.z.map((z) => (
            <g key={z}>
              <Circle cx={X(h.y)} cy={Y(z)} r={h.od / 2} fill="white" sw={LW.med} />
              {labels && (
                <Txt x={X(h.y)} y={Y(z)} size={1.0} anchor="middle" bold>
                  {id}
                </Txt>
              )}
            </g>
          ))}
        </Hit>
      ))}

      <Hit bom="C2">
        <Box
          x={X(sec.leakTray.y[0])}
          y={Y(sec.leakTray.z[1])}
          w={sec.leakTray.y[1] - sec.leakTray.y[0]}
          h={sec.leakTray.z[1] - sec.leakTray.z[0]}
          fill="dark"
          sw={LW.thin}
        />
      </Hit>
      {labels && (
        <>
          <Txt x={X(sec.leakTray.y[1]) - 50} y={Y(sec.leakTray.z[0]) + 220} size={1.0} anchor="end" bold>
            LEAK TRAY
          </Txt>
          <TextBlock
            x={W / 2}
            y={Y((ceil + sec.fiber.trays[1][1]) / 2 + 250)}
            lines={["OPEN SERVICE PLENUM"]}
            size={1.2}
          />
        </>
      )}
    </g>
  );
}
