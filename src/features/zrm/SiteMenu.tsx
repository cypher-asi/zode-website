"use client";

import type { ReactElement } from "react";
import { SITE_MENU_FIELDS, type FieldSpec } from "./fields";
import { RowMenu } from "./RowMenu";
import type { Option, SiteRow, SiteStatus } from "./types";

function choices(field: FieldSpec, statuses: readonly SiteStatus[]): Option[] {
  if (field.type === "status") return statuses.map((status) => ({ value: status.id, label: status.name }));
  return [{ value: "", label: "None" }, ...(field.options ?? []).map((value) => ({ value, label: value }))];
}

/** A site's right-click menu in the list: open it, set its status, type or deal type, pin it, or delete it. */
export function SiteMenu({
  site,
  x,
  y,
  statuses,
  onOpen,
  onChange,
  onPin,
  onDelete,
  onClose,
}: {
  site: SiteRow;
  x: number;
  y: number;
  statuses: readonly SiteStatus[];
  onOpen: () => void;
  onChange: (key: string, value: string) => void;
  onPin: () => void;
  onDelete: () => Promise<string | undefined>;
  onClose: (restoreFocus: boolean) => void;
}): ReactElement {
  return (
    <RowMenu
      name={site.name}
      x={x}
      y={y}
      active={site.active}
      choices={SITE_MENU_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        options: choices(field, statuses),
        current: String((site as unknown as Record<string, unknown>)[field.key] ?? ""),
      }))}
      deleteDescription="Its notes go with it. This can't be undone."
      onOpen={onOpen}
      onChange={onChange}
      onPin={onPin}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}
