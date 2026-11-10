"use client";

import { useId, useState, type ReactElement } from "react";
import { Icon } from "./icons";
import type { TableRow } from "./SummaryParts";
import t from "./Tables.module.css";

/** A table row with its figures that opens to its parts beneath it, hidden until then. */
export function ExpandableRows({ row }: { row: TableRow }): ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  const parts = row.parts ?? [];
  return (
    <>
      <tr>
        <th scope="row">
          <button
            type="button"
            className={t.toggle}
            aria-expanded={open}
            aria-controls={parts.map((_, i) => `${id}-${i}`).join(" ")}
            onClick={() => setOpen((o) => !o)}
          >
            {row.label}
            <Icon name="chevron" className={t.chevron} />
          </button>
        </th>
        {row.values.map((v, i) => (
          <td key={i}>{v}</td>
        ))}
      </tr>
      {parts.map((part, i) => (
        <tr key={`${i}:${part.label}`} id={`${id}-${i}`} className={t.nested} hidden={!open}>
          <th scope="row">{part.label}</th>
          {part.values.map((v, j) => (
            <td key={j}>{v}</td>
          ))}
        </tr>
      ))}
    </>
  );
}
