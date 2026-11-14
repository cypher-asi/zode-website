import { Dim, Hit, Line, LINE_STYLES, LW, Txt } from "@/features/chassis/drawing/core";
import { placementSize } from "@/features/chassis/drawing/podPlan";
import { fmt } from "@/features/chassis/model/format";
import { PodPlanSheet } from "./PodPlanSheet";
import { useSheetData } from "./useSheetData";

export function CoolingPod() {
  const { data, d } = useSheetData();
  const pod = data.pods.pods.find((p) => p.id === "cooling")!;
  const ch = data.pods.chassis;
  const { wall, clearL, clearW } = d.geometry;
  const W = ch.width;
  const tanks = pod.placements.filter((p) => p.bom === "M14");
  const tankOd = tanks[0] ? placementSize(tanks[0], d).w : 0;

  return (
    <PodPlanSheet
      podId="cooling"
      interior={
        <g>
          <Hit bom="M1">
            <Line x1={0} y1={30} x2={clearL} y2={30} sw={LINE_STYLES.dtc.sw} dash={LINE_STYLES.dtc.dash} />
            <Line
              x1={0}
              y1={clearW - 30}
              x2={clearL}
              y2={clearW - 30}
              sw={LINE_STYLES.rdhx.sw}
              dash={LINE_STYLES.rdhx.dash}
            />
          </Hit>
          <Txt x={-wall - 40} y={30} size={1.0} anchor="end" bold>
            W / DTC
          </Txt>
          <Txt x={-wall - 40} y={clearW - 30} size={1.0} anchor="end" bold>
            C / CHW
          </Txt>
        </g>
      }
      exterior={
        <g>
          {tanks.map((t) => (
            <g key={t.id}>
              <Line x1={wall + t.x} y1={0} x2={wall + t.x} y2={-300} sw={LW.thin} arrow="end" />
              <Line x1={wall + t.x} y1={W} x2={wall + t.x} y2={W + 300} sw={LW.thin} arrow="end" />
            </g>
          ))}
          {tanks[0] && (
            <>
              <Txt x={wall + tanks[0].x + 500} y={W + 450} size={1.15} bold>
                {pod.exteriorNote}
              </Txt>
              <Dim
                x1={wall + tanks[0].x - tankOd / 2}
                y1={W}
                x2={wall + tanks[0].x + tankOd / 2}
                y2={W}
                offset={17}
                text={`${fmt(tankOd)} insulated tank OD reservation`}
              />
            </>
          )}
        </g>
      }
    />
  );
}
