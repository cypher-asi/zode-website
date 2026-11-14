import { Dim, Line, LW, Txt } from "@/features/chassis/drawing/core";
import { placementSize } from "@/features/chassis/drawing/podPlan";
import { fmt } from "@/features/chassis/model/format";
import { PodPlanSheet } from "./PodPlanSheet";
import { useSheetData } from "./useSheetData";

export function ElectricalPod() {
  const { data, d } = useSheetData();
  const pod = data.pods.pods.find((p) => p.id === "electrical")!;
  const ch = data.pods.chassis;
  const { wall } = d.geometry;
  const W = ch.width;
  const [p0, p1] = pod.partitions;
  const lvStart = p0 ? p0.x + p0.w : 0;
  const lvEnd = p1 ? p1.x : 0;

  // Access arrows at the centre of each compartment.
  const bays = [0, ...pod.partitions.map((p) => p.x + p.w)].map((start, i) => {
    const end = pod.partitions[i]?.x ?? d.geometry.clearL;
    return wall + (start + end) / 2;
  });
  const e1 = pod.placements.find((p) => p.id === "E1");
  const e1Mid = e1 ? wall + e1.x + placementSize(e1, d).w / 2 : bays[0];

  return (
    <PodPlanSheet
      podId="electrical"
      exterior={
        <g>
          {bays.map((x) => (
            <g key={x}>
              <Line x1={x} y1={0} x2={x} y2={-300} sw={LW.thin} arrow="end" />
              <Line x1={x} y1={W} x2={x} y2={W + 300} sw={LW.thin} arrow="end" />
            </g>
          ))}
          <Txt x={e1Mid} y={W + 520} size={1.15} anchor="middle" bold>
            EXTERIOR SERVICE ACCESS
          </Txt>
          <Txt x={bays.at(-1)!} y={W + 520} size={1.15} anchor="middle" bold>
            REAR ACCESS TO FUTURE BAY
          </Txt>
          {p0 && p1 && (
            <Dim
              x1={wall + lvStart}
              y1={W}
              x2={wall + lvEnd}
              y2={W}
              offset={14}
              textSide="above"
              text={`${fmt(lvEnd - lvStart)} LV compartment length`}
            />
          )}
        </g>
      }
    />
  );
}
