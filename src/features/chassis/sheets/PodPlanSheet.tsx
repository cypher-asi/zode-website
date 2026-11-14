import type { ReactNode } from "react";
import { Dim, Txt, View } from "@/features/chassis/drawing/core";
import { PlacementShape, PodShell } from "@/features/chassis/drawing/podPlan";
import { fmt } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

export const POD_PLAN = { x: 59, y: 82, scale: 1 / 20 };

/** Shared 1:20 plan of one pod: shell, wall zones, partitions and every placement in pods.json. */
export function PodPlanSheet({
  podId,
  interior,
  exterior,
}: {
  podId: string;
  interior?: ReactNode;
  exterior?: ReactNode;
}) {
  const { data, d } = useSheetData();
  const pod = data.pods.pods.find((p) => p.id === podId);
  if (!pod) return null;
  const ch = data.pods.chassis;
  const { wall, clearL, clearW } = d.geometry;

  return (
    <View x={POD_PLAN.x} y={POD_PLAN.y} scale={POD_PLAN.scale}>
      <Dim
        x1={0}
        y1={0}
        x2={ch.length}
        y2={0}
        offset={-20}
        text={`${fmt(ch.length)} overall / ${fmt(clearL)} clear / ${wall} wall zone / ${ch.wallCore} insulation`}
      />
      <Dim x1={0} y1={0} x2={0} y2={ch.width} offset={-10} text={`${fmt(ch.width)} overall / ${fmt(clearW)} clear`} />
      <PodShell pod={pod} wall={wall} length={ch.length} width={ch.width}>
        {interior}
        {pod.placements.map((p) => (
          <PlacementShape key={p.id} p={p} d={d} />
        ))}
        {pod.annotations.map((a, i) => (
          <Txt key={i} x={a.x} y={a.y + 60} size={1.15} anchor="middle" bold={a.bold}>
            {a.text}
          </Txt>
        ))}
      </PodShell>
      {exterior}
    </View>
  );
}
