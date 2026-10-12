const int = (n: number) => Math.round(n).toLocaleString("en-US");

export const count = int;

export const power = (kw: number) =>
  kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : kw < 100 ? `${Number(kw.toFixed(1))} kW` : `${int(kw)} kW`;

export const capacityTb = (tb: number) => (tb >= 1000 ? `${(tb / 1000).toFixed(tb % 1000 ? 1 : 0)} PB` : `${int(tb)} TB`);

export const exaflops = (ef: number) => (ef >= 1 ? `${ef.toFixed(1)} EF` : `${int(ef * 1000)} PF`);

export const bandwidth = (tbps: number) => (tbps >= 1000 ? `${(tbps / 1000).toFixed(1)} Pb/s` : `${int(tbps)} Tb/s`);

export const units = (u: number) => `U${u}`;
