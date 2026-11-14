import type { RoofProfile } from "@/features/chassis/model/schema";
import { Box, DASH, Hit, Line, LW, Poly, Txt, useK } from "./core";
import { INK } from "@/features/chassis/drawing/palette";

/**
 * Dry-cooler roof cross-section in real mm. Origin = top-left of the module;
 * y grows downward, so a height z above the roof base maps to y = height - z.
 */
export function RoofSection({
  roof,
  width,
  variant = "stack",
}: {
  roof: RoofProfile;
  width: number;
  variant?: "stack" | "winter";
}) {
  const k = useK();
  const s = roof.stack;
  const c = roof.coil;
  if (!s || !c) return null;
  const H = roof.height;
  const Y = (z: number) => H - z;
  const mid = width / 2;
  const rise = s.coilHigh - s.coilBottom;
  const run = Math.sqrt(Math.max(0, c.slant ** 2 - rise ** 2));
  const fans = Array.from({ length: roof.fanRows }, (_, r) => roof.sideMargin + r * (roof.frame + roof.centerGap));

  const coil = (side: -1 | 1) => {
    const inner = mid + side * (roof.centerGap / 2 + 40);
    const outer = inner + side * run;
    // Offset perpendicular to the slant by the coil thickness.
    const px = ((-side * rise) / c.slant) * c.thick;
    const py = (-run / c.slant) * c.thick;
    const p: [number, number][] = [
      [outer, Y(s.coilHigh)],
      [inner, Y(s.coilBottom)],
      [inner + px, Y(s.coilBottom) + py],
      [outer + px, Y(s.coilHigh) + py],
    ];
    return p;
  };

  return (
    <g>
      <Hit part="cooler-frame">
        <Box x={0} y={0} w={width} h={H} fill="none" sw={LW.med} />
      </Hit>

      {fans.map((fx, i) => (
        <Hit key={i} part={roof.fanPart}>
          <Box x={fx} y={Y(s.fanFlange)} w={roof.frame} h={s.fanFlange - s.fanLow} fill="white" sw={LW.med} />
          <Box x={fx + roof.frame / 2 - 130} y={Y(s.fanFlange) + 60} w={260} h={190} fill="dark" sw={LW.thin} />
          <Box
            x={fx}
            y={Y(s.guardTop)}
            w={roof.frame}
            h={s.guardTop - s.fanFlange}
            fill="none"
            dash={DASH.fine}
            sw={LW.thin}
          />
          {variant === "winter" && (
            <Line
              x1={fx + roof.frame / 2}
              y1={Y(s.guardTop) - 20}
              x2={fx + roof.frame / 2}
              y2={Y(s.guardTop) - 420}
              sw={LW.thin}
              arrow="end"
            />
          )}
        </Hit>
      ))}

      {([-1, 1] as const).map((side) => (
        <Hit key={side} part="coil-bank">
          <Poly points={coil(side)} closed fill="light" sw={LW.med} />
        </Hit>
      ))}

      {/* side air intakes */}
      {[
        [-500, 0],
        [width + 500, width],
      ].map(([from, to]) => (
        <Line
          key={from}
          x1={from}
          y1={Y((s.coilHigh + s.coilBottom) / 2)}
          x2={to + (to === 0 ? 120 : -120)}
          y2={Y((s.coilHigh + s.coilBottom) / 2)}
          sw={LW.thin}
          arrow="end"
        />
      ))}

      <Hit part="drip-deck">
        <Line x1={0} y1={Y(s.deckTop)} x2={width} y2={Y(s.deckTop)} sw={LW.thick} />
        <Line x1={0} y1={Y(s.deckTop) + 30} x2={width} y2={Y(s.deckTop) + 30} sw={LW.thin} />
      </Hit>
      <Hit bom="S9">
        <Line x1={0} y1={Y(s.deckTop / 2 + 20)} x2={width} y2={Y(s.deckTop / 2 + 20)} sw={LW.thin} />
      </Hit>
      <Line x1={0} y1={Y(30)} x2={width} y2={Y(30)} sw={LW.med} />
      <Line x1={0} y1={Y(0)} x2={width} y2={Y(0)} sw={LW.thick} />

      {variant === "stack" ? (
        <>
          <Txt x={width + 60} y={Y(s.deckTop)} size={1.0} bold>
            M3 DECK
          </Txt>
          <Txt x={width + 60} y={Y(s.deckTop / 2 + 20)} size={1.0} bold>
            S9 PAN*
          </Txt>
          <Txt x={width + 60} y={Y(15)} size={1.0} bold>
            WEATHER ROOF
          </Txt>
          <Txt x={mid + 300} y={Y((s.coilHigh + s.fanLow) / 2 + 60)} size={1.0} bold>
            {`${s.fanLow - s.coilHigh} CLEAR TO FAN`}
          </Txt>
          <Txt x={mid} y={Y(s.coilBottom + rise * 0.55)} size={1.1} anchor="middle" bold>
            ANGLED COILS
          </Txt>
        </>
      ) : (
        <>
          <rect
            x={0}
            y={Y(s.drainSkin[1])}
            width={width}
            height={s.drainSkin[1] - s.drainSkin[0]}
            fill="none"
            stroke={INK}
            strokeWidth={LW.thin / k}
            strokeDasharray={`${0.6 / k} ${0.6 / k}`}
          />
          <Txt x={mid} y={Y(s.coilBottom + rise * 0.55)} size={1.1} anchor="middle" bold>
            SEALED COIL BAFFLES
          </Txt>
        </>
      )}
    </g>
  );
}
