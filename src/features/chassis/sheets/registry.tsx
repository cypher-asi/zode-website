import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import styles from "@/features/chassis/chassis.module.css";
import { AREA } from "@/features/chassis/drawing/SheetFrame";
import { Txt } from "@/features/chassis/drawing/core";
import { ComputePod } from "./G101ComputePod";
import { StructuralChassis } from "./G103StructuralChassis";
import { SitePlan } from "./G001SitePlan";
import { ElectricalPod } from "./E102ElectricalPod";
import { CoolingPod } from "./M101CoolingPod";
import { DryCoolerRoof } from "./M103DryCoolerRoof";
import { RackDimensions } from "./G105RackDimensions";
import { RackSpacePower } from "./G106RackSpacePower";
import { RackBuswayFit } from "./G107RackBuswayFit";
import { RoofClearances } from "./G108RoofClearances";
import { SingleLine } from "./E101SingleLine";
import { CoolingLoops } from "./M102CoolingLoops";
import { BomCost } from "./G601BomCost";
import { CoolingCapacity } from "./M104CoolingCapacity";
import { RoofWinter } from "./M105RoofWinter";
import { ComputeInteriorSheet, ExteriorSheet, INTERIOR_RECT, EXTERIOR_RECT } from "./threeSheets";

export interface SheetDef {
  Component: ComponentType;
  scene?: { rect: { x: number; y: number; w: number; h: number }; Scene: ComponentType };
}

// WebGL only runs in the browser, and three.js only loads for the sheets that draw in it.
const loading = () => <div className={styles.sceneLoading}>Loading 3D…</div>;
const ComputeInteriorScene = dynamic(() => import("@/features/chassis/three/ComputeInteriorScene"), {
  ssr: false,
  loading,
});
const ExteriorScene = dynamic(() => import("@/features/chassis/three/ExteriorScene"), { ssr: false, loading });

export const SHEET_RENDERERS: Record<string, SheetDef> = {
  computePod: { Component: ComputePod },
  computeInterior3d: { Component: ComputeInteriorSheet, scene: { rect: INTERIOR_RECT, Scene: ComputeInteriorScene } },
  rackDimensions: { Component: RackDimensions },
  rackSpacePower: { Component: RackSpacePower },
  singleLine: { Component: SingleLine },
  electricalPod: { Component: ElectricalPod },
  coolingPod: { Component: CoolingPod },
  coolingLoops: { Component: CoolingLoops },
  sitePlan: { Component: SitePlan },
  exterior3d: { Component: ExteriorSheet, scene: { rect: EXTERIOR_RECT, Scene: ExteriorScene } },
  bomCost: { Component: BomCost },
  rackBuswayFit: { Component: RackBuswayFit },
  structuralChassis: { Component: StructuralChassis },
  dryCoolerRoof: { Component: DryCoolerRoof },
  roofClearances: { Component: RoofClearances },
  coolingCapacity: { Component: CoolingCapacity },
  roofWinter: { Component: RoofWinter },
};

export function MissingRenderer({ name }: { name: string }) {
  return (
    <Txt x={AREA.x + AREA.w / 2} y={AREA.y + AREA.h / 2} size={3} anchor="middle">
      {`No renderer registered for "${name}"`}
    </Txt>
  );
}
