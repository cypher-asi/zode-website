"use client";

import type { ReactElement } from "react";
import { OPPORTUNITY_DEAL_TYPES } from "./fields";
import { RowMenu } from "./RowMenu";
import type { OpportunityKind, OpportunityRow, Stage } from "./types";

/** An opportunity's right-click menu in the list: open it, move it to another stage, set its deal type, pin it, or delete it. */
export function OpportunityMenu({
  kind,
  opportunity,
  x,
  y,
  stages,
  onOpen,
  onChange,
  onPin,
  onDelete,
  onClose,
}: {
  kind: OpportunityKind;
  opportunity: OpportunityRow;
  x: number;
  y: number;
  stages: readonly Stage[];
  onOpen: () => void;
  onChange: (key: "stage_id" | "deal_type", value: string) => void;
  onPin: () => void;
  onDelete: () => Promise<string | undefined>;
  onClose: (restoreFocus: boolean) => void;
}): ReactElement {
  const stageOptions = stages
    .filter((stage) => stage.pipeline === kind)
    .sort((a, b) => a.position - b.position)
    .map((stage) => ({ value: stage.id, label: stage.name }));
  return (
    <RowMenu
      name={opportunity.title}
      x={x}
      y={y}
      active={opportunity.active}
      choices={[
        { key: "stage_id", label: "Stage", options: stageOptions, current: opportunity.stage_id },
        {
          key: "deal_type",
          label: "Deal type",
          options: OPPORTUNITY_DEAL_TYPES[kind].map((type) => ({ value: type, label: type })),
          current: opportunity.deal_type,
        },
      ]}
      deleteDescription="Its activities and notes go with it. This can't be undone."
      onOpen={onOpen}
      onChange={(key, value) => onChange(key as "stage_id" | "deal_type", value)}
      onPin={onPin}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}
