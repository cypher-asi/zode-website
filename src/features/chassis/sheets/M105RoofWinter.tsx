import { Box, LW, Para, paraHeight, SectionTitle, Txt, View } from "@/features/chassis/drawing/core";
import { RoofSection } from "@/features/chassis/drawing/roofSection";
import { fmt, tpl } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

const NOTE_X = 216;
const NOTE_W = 190;

export function RoofWinter() {
  const { data, d } = useSheetData();
  const roof = data.pods.roofProfiles.find((r) => r.type === "dry-cooler");
  const sheet = data.sheets.sheets.find((s) => s.id === "M-105");
  const W = data.pods.chassis.width;
  if (!roof || !roof.stack) return null;
  const s = roof.stack;
  const collar = s.fanFlange - s.drainSkin[1];

  const notes = (sheet?.notes ?? []).reduce<{ title: string; body: string; top: number; h: number }[]>((placed, n) => {
    const body = tpl(n.body, d.vars);
    const h = 8 + paraHeight(body, NOTE_W - 6, 1.2) + 2;
    const last = placed.at(-1);
    return [...placed, { ...n, body, top: last ? last.top + last.h + 3 : 44, h }];
  }, []);

  return (
    <g>
      <SectionTitle x={13} y={36}>
        01 COOLER ROOF SECTION / DESIGN RESERVES
      </SectionTitle>
      <View x={38} y={70} scale={1 / 18}>
        <RoofSection roof={roof} width={W} variant="winter" />
      </View>
      <Txt x={38 + W / 36} y={170} size={1.25} anchor="middle" bold>
        {`${fmt(W)} overall / two horizontal fan rows / vertical side intakes`}
      </Txt>
      <Para
        x={13}
        y={240}
        w={190}
        size={1.25}
        text={`Top drain skin Z${fmt(s.drainSkin[0])}-${fmt(s.drainSkin[1])}; fan flange Z${fmt(s.fanFlange)}; guards to Z${fmt(s.guardTop)}. Minimum ${collar} mm collar above adjacent skin. This limits runoff entry but does not clear snow drifts. Guards and the ${roof.gap} mm frame gap are not walkways.`}
      />

      <SectionTitle x={NOTE_X} y={36}>
        02 WINTER REQUIREMENTS / M3S + SHARED SYSTEMS
      </SectionTitle>
      {notes.map((n) => (
        <g key={n.title}>
          <Box x={NOTE_X} y={n.top} w={NOTE_W} h={n.h} fill="white" sw={LW.med} />
          <Box x={NOTE_X} y={n.top} w={2} h={n.h} fill="dark" sw={LW.med} />
          <Txt x={NOTE_X + 4} y={n.top + 4} size={1.45} bold>
            {n.title}
          </Txt>
          <Para x={NOTE_X + 4} y={n.top + 8.5} w={NOTE_W - 6} size={1.2} text={n.body} />
        </g>
      ))}
    </g>
  );
}
