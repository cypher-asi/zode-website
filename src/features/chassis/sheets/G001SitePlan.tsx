import { Box, Circle, DASH, Dim, Hit, Line, LW, Poly, TextBlock, Txt, View } from "@/features/chassis/drawing/core";
import { placementSize } from "@/features/chassis/drawing/podPlan";
import { fmt, tpl } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

const SCALE = 1 / 50;

export function SitePlan() {
  const { data, d } = useSheetData();
  const ch = data.pods.chassis;
  const bay = data.racks.bay;
  const { wall, rowLength, clearW } = d.geometry;
  const L = ch.length;
  const W = ch.width;
  const joints = d.pods.length - 1;
  const front = data.site.links.filter((l) => l.side === "front");
  const rear = data.site.links.filter((l) => l.side === "rear");
  const cooling = d.pods.find((p) => p.pod.id === "cooling");
  const compute = d.pods.find((p) => p.pod.id === "compute");
  const chiller = data.site.equipment.find((e) => e.fans > 0);

  return (
    <g>
      <View x={26.5} y={86} scale={SCALE}>
        <Dim
          x1={0}
          y1={0}
          x2={rowLength}
          y2={0}
          offset={-18}
          text={`${fmt(data.site.row.targetLength)} mm target with ${joints === 2 ? "two" : joints} ${data.site.row.joint} mm erection joints / ${data.site.row.targetLabel}`}
        />

        {/* front A/B power link */}
        {front.map((l) =>
          cooling && compute ? (
            <Hit key={l.id} bom={l.bom}>
              <Line x1={cooling.x - 2500} y1={-500} x2={compute.x + L - 400} y2={-500} sw={LW.thick} />
              <Txt x={cooling.x - 2000} y={-800} size={1.1} bold>
                {l.label}
              </Txt>
            </Hit>
          ) : null,
        )}

        {d.pods.map(({ pod, x }) => (
          <g key={pod.id} transform={`translate(${x} 0)`}>
            <Txt x={L / 2} y={-300} size={1.6} anchor="middle" bold>
              {pod.name}
            </Txt>
            <Hit bom={pod.shellBom}>
              <Box x={0} y={0} w={L} h={W} fill="white" sw={LW.med} />
              <Box x={wall} y={wall} w={L - 2 * wall} h={clearW} fill="white" sw={LW.thin} />
            </Hit>
            <g transform={`translate(${wall} ${wall})`}>
              {pod.placements
                .filter((p) => p.siteLabel)
                .map((p) => {
                  const s = placementSize(p, d);
                  return (
                    <Hit key={p.id} bom={p.bom} part={p.part}>
                      {p.shape === "circle" ? (
                        <>
                          <Circle cx={p.x} cy={p.y} r={s.w / 2} fill="white" />
                          <Txt x={p.x} y={p.y} size={1} anchor="middle" bold>
                            {p.siteLabel}
                          </Txt>
                        </>
                      ) : (
                        <Box
                          x={p.x}
                          y={p.y}
                          w={s.w}
                          h={p.id === "E1" ? s.d : Math.max(s.d, 1500)}
                          fill="light"
                          label={[p.siteLabel!]}
                          labelSize={1}
                        />
                      )}
                    </Hit>
                  );
                })}
              {pod.id === "compute" &&
                d.racks.map((r) => (
                  <Hit key={r.id} rack={r.id}>
                    <Box
                      x={r.x}
                      y={bay.frontZone}
                      w={bay.pitch}
                      h={bay.depth}
                      fill={r.type.role === "central" ? "dark" : "white"}
                      sw={LW.thin}
                    />
                    <Txt
                      x={r.x + bay.pitch / 2}
                      y={bay.frontZone + bay.depth / 2}
                      size={1}
                      anchor="middle"
                      rotate={-90}
                      bold
                    >
                      {r.id}
                    </Txt>
                  </Hit>
                ))}
            </g>
            <TextBlock
              x={L / 2}
              y={W + 1100}
              lines={[
                pod.roof.label,
                `${fmt(L)} x ${fmt(W)} body / ${fmt(ch.transitHeight)} transit / ${fmt(d.geometry.deployedHeight)} deployed`,
              ]}
              size={1.0}
              firstSize={1.15}
              gap={1.7}
            />
          </g>
        ))}

        {/* rear W / C links from the cooling pod */}
        {cooling && compute && chiller && (
          <g>
            {rear.map((l, i) => {
              const off = i * 180;
              const dash = l.style === "dashdot" ? DASH.dashdot : DASH.dashed;
              const x0 = cooling.x - 900 + off;
              return (
                <Hit key={l.id} bom={l.bom}>
                  <Poly
                    points={[
                      [cooling.x + 500 + off, W],
                      [cooling.x + 500 + off, W + 300],
                      [x0, W + 300],
                      [x0, W],
                    ]}
                    sw={LW.thin}
                    dash={dash}
                  />
                  <Poly
                    points={[
                      [cooling.x + 1300 + off, W],
                      [cooling.x + 1300 + off, W + 400 + off],
                      [compute.x + 600 + off, W + 400 + off],
                      [compute.x + 600 + off, W],
                    ]}
                    sw={LW.thin}
                    dash={dash}
                  />
                  <Poly
                    points={[
                      [cooling.x + 1100 + off, W],
                      [cooling.x + 1100 + off, chiller.y],
                    ]}
                    sw={LW.thin}
                    dash={dash}
                  />
                </Hit>
              );
            })}
            <Txt x={cooling.x} y={W + 2400} size={1.05} bold>
              {rear.map((l) => l.label).join(" / ")}
            </Txt>
          </g>
        )}

        {data.site.equipment.map((e) => {
          const vars = { l_m: (e.l / 1000).toFixed(3), w_m: (e.w / 1000).toFixed(3) };
          return (
            <g key={e.id}>
              {e.fans > 0 && (
                <Txt x={e.x + e.l / 2} y={e.y - 400} size={1.3} anchor="middle" bold>
                  {e.label}
                </Txt>
              )}
              <Hit bom={e.bom}>
                <Box
                  x={e.x}
                  y={e.y}
                  w={e.l}
                  h={e.w}
                  fill="light"
                  label={e.fans > 0 ? [] : [e.label, ...e.lines]}
                  labelSize={1.2}
                />
                {Array.from({ length: e.fans }, (_, i) => {
                  const pitch = e.l / e.fans;
                  return (
                    <Circle
                      key={i}
                      cx={e.x + pitch * (i + 0.5)}
                      cy={e.y + e.w / 2}
                      r={Math.min(pitch, e.w) * 0.38}
                      fill="dark"
                      sw={LW.thin}
                    />
                  );
                })}
              </Hit>
              {e.note && (
                <Txt
                  x={e.fans > 0 ? e.x + e.l / 2 : e.x}
                  y={e.y + e.w + 450}
                  size={1.05}
                  anchor={e.fans > 0 ? "middle" : "start"}
                >
                  {tpl(e.note, vars)}
                </Txt>
              )}
            </g>
          );
        })}
      </View>
    </g>
  );
}
