"use client";

import { useState } from "react";
import { Combobox } from "@/components/ui/Combobox";

const NAMES = ["Acme Power", "Northwind Data", "Crusoe", "Lambda", "CoreWeave", "Applied Digital", "Aligned", "Equinix"];

export default function Page() {
  const [options, setOptions] = useState([{ value: "", label: "None" }, ...NAMES.map((n, i) => ({ value: `id${i}`, label: n }))]);
  const [value, setValue] = useState("id2");
  const [log, setLog] = useState<string[]>([]);
  return (
    <main style={{ padding: 40, maxWidth: 420 }}>
      <label id="lbl" htmlFor="cb">Provider</label>
      <Combobox
        id="cb"
        aria-labelledby="lbl"
        name="provider"
        size="sm"
        options={options}
        value={value}
        placeholder="Search or add a company"
        onChange={(v, o) => {
          setValue(v);
          setLog((l) => [...l, `change ${v} ${o.label}`]);
        }}
        onCreate={async (q) => {
          await new Promise((r) => setTimeout(r, 400));
          const option = { value: `new-${q}`, label: q };
          setOptions((o) => [...o, option]);
          return { option };
        }}
      />
      <pre id="log">{`value=${value}\n${log.join("\n")}`}</pre>
    </main>
  );
}
