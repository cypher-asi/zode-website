import { Box, DASH, Hit, LW, Poly, SectionTitle, TextBlock, Txt } from "@/features/chassis/drawing/core";
import { PumpPair, TagBox, Valve } from "@/features/chassis/drawing/symbols";
import { tpl, type Vars } from "@/features/chassis/model/format";
import type { CoolingComponent, CoolingEdge } from "@/features/chassis/model/schema";
import { useSheetData } from "./useSheetData";

export function CoolingLoops() {
  const { data, d } = useSheetData();
  const c = data.cooling;
  const v = d.vars;

  return (
    <g>
      {c.loops.map((l) => (
        <SectionTitle key={l.id} x={l.at[0]} y={l.at[1]}>
          {l.title}
        </SectionTitle>
      ))}
      {c.edges.map((e, i) => (e.kind === "heat" ? null : <EdgeLine key={i} edge={e} vars={v} />))}
      {c.components.map((comp) => (
        <Hit key={comp.id} bom={comp.bom} part={comp.part}>
          <Component comp={comp} vars={v} />
        </Hit>
      ))}
      {/* Heat-transfer arrows sit inside components, so they draw last. */}
      {c.edges.map((e, i) => (e.kind === "heat" ? <EdgeLine key={i} edge={e} vars={v} /> : null))}
      {c.texts.map((t, i) => (
        <Txt key={i} x={t.at[0]} y={t.at[1]} size={t.size ?? 1.5} bold={t.bold}>
          {tpl(t.text, v)}
        </Txt>
      ))}
    </g>
  );
}

function EdgeLine({ edge, vars }: { edge: CoolingEdge; vars: Vars }) {
  const sw = edge.kind === "heat" ? LW.med : edge.loop === "W" ? LW.thick : LW.med;
  const dash = edge.kind === "heat" ? DASH.dotted : edge.kind === "bypass" ? DASH.dashed : null;
  return (
    <g>
      <Poly points={edge.points} sw={sw} dash={dash} arrow="end" />
      {edge.label && edge.labelAt && (
        <Txt x={edge.labelAt[0]} y={edge.labelAt[1]} size={1.15} anchor="middle" bold>
          {tpl(edge.label, vars)}
        </Txt>
      )}
    </g>
  );
}

function Component({ comp, vars }: { comp: CoolingComponent; vars: Vars }) {
  const { x, y, w, h } = comp.pos;
  const label = tpl(comp.label, vars);
  const lines = comp.lines.map((l) => tpl(l, vars));

  switch (comp.kind) {
    case "pumpPair": {
      const [a, b] = label.split("/").map((s) => s.trim().replace(/^P-/, ""));
      return (
        <g>
          <Box x={x} y={y} w={w} h={h} fill="white" sw={LW.med} />
          <Txt x={x + w / 2} y={y + 3.5} size={1.3} anchor="middle" bold>
            {label}
          </Txt>
          <PumpPair x={x} y={y + 4} w={w} h={h - 9} labels={[a ?? "1", b ?? "2"]} />
          {lines.map((l, i) => (
            <Txt key={i} x={x + w / 2} y={y + h - 2.5 - (lines.length - 1 - i) * 2} size={1.05} anchor="middle">
              {l}
            </Txt>
          ))}
        </g>
      );
    }
    case "valve":
      return (
        <g>
          <Valve x={x + w / 2} y={y + h / 2} s={w / 3} />
          <Txt x={x + w / 2} y={y - 1.5} size={1.05} anchor="middle" bold>
            {label}
          </Txt>
        </g>
      );
    case "roofBranches": {
      const ys = [y + h * 0.38, y + h * 0.66];
      return (
        <g>
          <Box x={x} y={y} w={w} h={h} fill="white" sw={LW.med} dash={DASH.dashed} />
          <Txt x={x + w / 2} y={y + 3.5} size={1.3} anchor="middle" bold>
            {label}
          </Txt>
          {ys.map((by, i) => (
            <g key={i}>
              <Poly
                points={[
                  [x, by],
                  [x + w, by],
                ]}
                sw={LW.thin}
              />
              <TagBox x={x + 4} y={by - 1.6} w={5} h={3.2} label="IV" size={0.9} />
              <TagBox x={x + 12} y={by - 1.6} w={6} h={3.2} label="FP" size={0.9} />
              <Box
                x={x + w / 2 - 11}
                y={by - 2.6}
                w={22}
                h={5.2}
                fill="light"
                sw={LW.thin}
                label={[`ROOF ${i + 1} COOLER`]}
                labelSize={0.95}
              />
              <TagBox x={x + w - 18} y={by - 1.6} w={6} h={3.2} label="BV" size={0.9} />
              <TagBox x={x + w - 10} y={by - 1.6} w={5} h={3.2} label="IV" size={0.9} />
            </g>
          ))}
          <Poly
            points={[
              [x + 2, ys[0]],
              [x + 2, ys[1]],
            ]}
            sw={LW.thin}
          />
          <Poly
            points={[
              [x + w - 2, ys[0]],
              [x + w - 2, ys[1]],
            ]}
            sw={LW.thin}
          />
          {lines.map((l, i) => (
            <Txt key={i} x={x + w / 2} y={y + h - 2.5 - (lines.length - 1 - i) * 2} size={1.0} anchor="middle">
              {l}
            </Txt>
          ))}
        </g>
      );
    }
    case "hx": {
      const mid = x + w / 2;
      const zig: [number, number][] = [];
      for (let i = 0; i <= 16; i++) zig.push([mid + (i % 2 ? 4 : -4), y + 30 + i * ((h - 56) / 16)]);
      return (
        <g>
          <Box x={x} y={y} w={w} h={h} fill="white" sw={LW.thick} />
          <Box x={x} y={y} w={w} h={9} fill="light" sw={LW.med} label={[label]} labelSize={1.3} />
          <Txt x={x + w * 0.25} y={y + 15} size={1.2} anchor="middle" bold>
            W SIDE
          </Txt>
          <Txt x={x + w * 0.75} y={y + 15} size={1.2} anchor="middle" bold>
            C SIDE
          </Txt>
          <Poly points={zig} sw={LW.med} />
          <TextBlock x={mid} y={y + h - 12} lines={lines} size={1.1} firstSize={1.7} gap={1.6} />
        </g>
      );
    }
    default:
      return (
        <Box
          x={x}
          y={y}
          w={w}
          h={h}
          fill={comp.style === "light" ? "light" : comp.style === "dark" ? "dark" : "white"}
          sw={LW.med}
          label={[label, ...lines]}
          labelSize={h < 10 ? 1.1 : 1.15}
          firstSize={h < 10 ? 1.2 : 1.4}
        />
      );
  }
}
