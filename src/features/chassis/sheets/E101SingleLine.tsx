import { Box, DASH, Hit, Line, LW, Para, Txt } from "@/features/chassis/drawing/core";
import { Breaker, Dot, Ground } from "@/features/chassis/drawing/symbols";
import { fmt, fmtN, tpl } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

const BUS_Y = 84;
const BUS_A_Y = 122;
const BUS_B_Y = 141;
const CHAIN_X = 349;

export function SingleLine() {
  const { data, d } = useSheetData();
  const el = data.electrical;
  const v = d.vars;
  const n = d.racks.length;
  const pitch = Math.min(26.3, 265 / Math.max(n, 1));
  const rackX = (i: number) => 21 + i * pitch;
  const [busA, busB] = el.busways;
  const [qfa, qfb] = el.mains;
  const feederAt: Record<string, [number, number]> = {
    [el.feeders[0]?.id ?? ""]: [26, 100],
    [el.feeders[1]?.id ?? ""]: [313, 394],
  };
  const chain = Object.fromEntries(el.coolingChain.map((c) => [c.id, c]));
  const chainBoxes: { id: string; y: number; h: number }[] = [
    { id: "E12", y: 107, h: 33 },
    { id: "E13", y: 153, h: 13 },
    { id: "AUX", y: 176, h: 21 },
    { id: "COOLPOD", y: 204, h: 14 },
  ];

  return (
    <g>
      {/* Switchboard + main bus */}
      <Hit bom={el.switchboard.bom}>
        <Box
          x={110}
          y={61}
          w={188}
          h={16}
          fill="light"
          sw={LW.thick}
          label={[el.switchboard.label, ...el.switchboard.lines]}
          labelSize={1.25}
          firstSize={1.6}
        />
        <Line x1={204} y1={77} x2={204} y2={BUS_Y} sw={LW.thick} />
        <Line x1={30} y1={BUS_Y} x2={401} y2={BUS_Y} sw={LW.heavy} />
        <Txt x={300} y={BUS_Y - 2} size={1.1} bold>
          {`MAIN LV BUS / ${fmt(el.switchboard.amps)} A / ${el.system.label}`}
        </Txt>
      </Hit>

      {el.feeders.map((f) => {
        const [x0, x1] = feederAt[f.id] ?? [26, 100];
        const cx = (x0 + x1) / 2;
        return (
          <Hit key={f.id} bom={f.bom}>
            <Box x={x0} y={61} w={x1 - x0} h={12} label={[f.label, ...f.lines]} labelSize={1.05} firstSize={1.3} />
            <Line x1={cx} y1={73} x2={cx} y2={BUS_Y} />
            <Breaker x={cx} y={78.5} s={3} />
          </Hit>
        );
      })}

      <Hit bom={el.originSpd.bom}>
        <Line x1={175} y1={BUS_Y} x2={175} y2={88} />
        <Box x={164} y={88} w={22} h={8} label={[el.originSpd.label, ...el.originSpd.lines]} labelSize={1.0} />
        <Line x1={186} y1={92} x2={190} y2={92} />
        <Ground x={190} y={92} />
      </Hit>

      {/* Mains -> busways */}
      {[
        { main: qfa, bus: busA, x: 48, y: BUS_A_Y },
        { main: qfb, bus: busB, x: 242, y: BUS_B_Y },
      ].map(({ main, bus, x, y }) =>
        main && bus ? (
          <g key={main.id}>
            <Hit bom={main.bom}>
              <Line x1={x} y1={BUS_Y} x2={x} y2={y} sw={LW.thick} />
              <Dot x={x} y={BUS_Y} />
              <Breaker x={x} y={96} s={4} />
              <Txt x={x + 4} y={95} size={1.3} bold>
                {main.label}
              </Txt>
              {main.lines.map((l, i) => (
                <Txt key={i} x={x + 4} y={98.5 + i * 2.2} size={1.0}>
                  {l}
                </Txt>
              ))}
            </Hit>
            <Hit bom={bus.bom}>
              <Line x1={20} y1={y} x2={288} y2={y} sw={LW.heavy} />
              <Txt x={20} y={y - 2.2} size={1.25} bold>
                {bus.label}
              </Txt>
              <Line x1={278} y1={y} x2={278} y2={y + 3} />
              <Box x={268} y={y + 3} w={20} h={5} label={[bus.spd]} labelSize={1.0} />
            </Hit>
          </g>
        ) : null,
      )}

      {/* Compute pod */}
      <Box x={15} y={109} w={276} h={121} fill="none" dash={DASH.dashed} sw={LW.med} />
      <Txt x={18} y={113} size={1.45} bold>
        {tpl(el.computeBoxLabel, v)}
      </Txt>

      {d.power.racks.map((rp, i) => {
        const x = rackX(i);
        const w = pitch - 3;
        const cx = x + w / 2;
        const legs = [
          { bank: rp.banks[0], x: cx - w / 4, busY: BUS_A_Y },
          { bank: rp.banks[1], x: cx + w / 4, busY: BUS_B_Y },
        ];
        return (
          <g key={rp.rack.id}>
            <Hit part="busway-tap" title={`${rp.rack.tap} -> ${rp.rack.id}`}>
              {legs.map((leg) => (
                <g key={leg.bank?.bank}>
                  <Dot x={leg.x} y={leg.busY} r={0.4} />
                  <Line x1={leg.x} y1={leg.busY} x2={leg.x} y2={173} />
                  <Breaker x={leg.x} y={158} s={2.6} />
                </g>
              ))}
              <Txt x={cx} y={149} size={1.05} anchor="middle" bold>
                {rp.rack.tap}
              </Txt>
              <Txt x={cx} y={166} size={0.8} anchor="middle">
                {`${rp.tapAmps} A* each`}
              </Txt>
            </Hit>
            <Hit rack={rp.rack.id}>
              {legs.map((leg, li) =>
                leg.bank ? (
                  <Box
                    key={leg.bank.bank}
                    x={x + (li * w) / 2}
                    y={173}
                    w={w / 2}
                    h={22}
                    fill={li ? "white" : "light"}
                    sw={LW.thin}
                    label={[leg.bank.bank, ...groupBreakers(leg.bank.breakers), `${fmtN(leg.bank.kVA, 1)}`, "kVA"]}
                    labelSize={0.78}
                    firstSize={1.2}
                  />
                ) : null,
              )}
              <Line x1={x + w / 4} y1={195} x2={x + w / 4} y2={202} sw={LW.thin} />
              <Line x1={x + (3 * w) / 4} y1={195} x2={x + (3 * w) / 4} y2={202} sw={LW.thin} />
              <Box
                x={x}
                y={202}
                w={w}
                h={17}
                fill={rp.rack.type.role === "compute" ? "white" : "dark"}
                sw={LW.med}
                label={[rp.rack.id, `${rp.rack.kw} kW`, rp.rack.type.role === "compute" ? "GPU" : "NET/STOR"]}
                labelSize={0.9}
                firstSize={1.3}
              />
            </Hit>
          </g>
        );
      })}
      <Txt x={18} y={225} size={1.0}>
        {`* Tap and plug-in ratings provisional. Bank figures: sqrt(3) x ${el.system.vLL} V x design A at ${fmt(el.system.continuousFactor * 100)} % continuous, PF ${el.system.pf}.`}
      </Txt>

      {/* Protected cooling chain */}
      <Hit bom={chain.QAUX?.bom}>
        <Line x1={CHAIN_X} y1={BUS_Y} x2={CHAIN_X} y2={107} sw={LW.med} />
        <Dot x={CHAIN_X} y={BUS_Y} />
        <Breaker x={CHAIN_X} y={95} s={3.4} />
        <Txt x={CHAIN_X + 3.5} y={94} size={1.25} bold>
          {chain.QAUX?.label ?? "QAUX"}
        </Txt>
        <Txt x={CHAIN_X + 3.5} y={97.5} size={0.95}>
          {chain.QAUX?.lines[0] ?? ""}
        </Txt>
      </Hit>
      {chainBoxes.map((b, i) => {
        const c = chain[b.id];
        if (!c) return null;
        const next = chainBoxes[i + 1];
        return (
          <g key={b.id}>
            <Hit bom={c.bom}>
              <Box
                x={305}
                y={b.y}
                w={88}
                h={b.h}
                fill={b.id === "E12" ? "light" : "white"}
                sw={LW.med}
                label={[c.label, ...c.lines].map((l) => tpl(l, v))}
                labelSize={1.05}
                firstSize={1.25}
              />
            </Hit>
            {next && <Line x1={CHAIN_X} y1={b.y + b.h} x2={CHAIN_X} y2={next.y} sw={LW.med} arrow="end" />}
          </g>
        );
      })}
      <Hit bom="E13">
        <Line x1={401} y1={BUS_Y} x2={401} y2={159.5} sw={LW.thin} dash={DASH.dashed} />
        <Line x1={401} y1={159.5} x2={393} y2={159.5} sw={LW.thin} dash={DASH.dashed} arrow="end" />
        <Txt x={403.5} y={122} size={1.05} anchor="middle" rotate={-90} bold>
          MBP / MAINTENANCE BYPASS
        </Txt>
      </Hit>

      <Para x={15} y={239} w={276} size={1.15} text={el.system.note} />
      <Para x={15} y={246} w={276} size={1.15} bold text={el.checksNote} />
      <Para
        x={305}
        y={239}
        w={100}
        size={1.1}
        text={`A/B busways ${fmt(d.power.busLoadKw)} kW each at normal share vs ${fmt(d.power.busKw)} kW continuous. ${d.power.taps} taps total.`}
      />
    </g>
  );
}

function groupBreakers(breakers: number[]): string[] {
  const m = new Map<number, number>();
  for (const a of breakers) m.set(a, (m.get(a) ?? 0) + 1);
  return [...m].map(([a, n]) => `${n}x${a}`);
}
