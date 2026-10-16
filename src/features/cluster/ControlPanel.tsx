"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { ChipPicker, ChoiceGroup, NodeStepper, Readouts } from "@/features/configurator/StepPanel";
import { capacityTb, count, power } from "./format";
import { NODE_SIZES, PLATFORMS, RACK_HEIGHTS, ROW_LENGTHS, STORAGE_PER_NODE, SUPPORT } from "./model/catalog";
import type { ClusterConfig, ClusterModel, Layer } from "./model/types";
import {
  FABRIC_CHOICES,
  PLATFORM_CHOICES,
  TOPOLOGY_CHOICES,
  densityChoices,
  rackNote,
  storageLabel,
} from "./options";
import styles from "./ControlPanel.module.css";

function Section({ index, title, children }: { index: number; title: string; children: ReactNode }): ReactElement {
  return (
    <section className={styles.section} aria-labelledby={`cluster-section-${index}`}>
      <h2 id={`cluster-section-${index}`} className={styles.title}>
        <span className={styles.index}>{String(index).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Every setting on one scrolling panel rather than steps: each change
 * rebuilds the cluster in the viewport straight away, and hovering an option
 * outlines the part of the cluster it changes. With `configuredAt`, a
 * deployment's configuration (edited there) sets the cluster, and only its
 * size and rows are left to change here.
 */
export function ControlPanel({
  config,
  model,
  update,
  onPreview,
  configuredAt,
}: {
  config: ClusterConfig;
  model: ClusterModel;
  update: (patch: Partial<ClusterConfig>) => void;
  onPreview: (layer: Layer | null) => void;
  configuredAt?: string;
}): ReactElement {
  const { stats } = model;
  const free = !configuredAt;
  return (
    <>
      {configuredAt ? (
        <p className={styles.configured}>
          {PLATFORMS[config.platform].short}, {config.density} nodes to a {config.rackU}U rack,{" "}
          {FABRIC_CHOICES.find((choice) => choice.id === config.fabric)?.label} and {storageLabel(config.storagePerNode)}{" "}
          of storage per node come from the{" "}
          <Link href={configuredAt} prefetch={false}>
            deployment&apos;s configuration
          </Link>
          .
        </p>
      ) : null}

      <Section index={1} title="Compute">
        <NodeStepper sizes={NODE_SIZES} value={config.nodes} onChange={(nodes) => update({ nodes })} />
        <Readouts
          items={[
            { label: "GPUs", value: count(stats.gpus), detail: "8 per node" },
            { label: "IT power", value: power(stats.itKw), detail: "Compute, network and storage" },
          ]}
        />
        {free ? (
          <ChoiceGroup
            legend="GPU platform"
            choices={PLATFORM_CHOICES}
            value={config.platform}
            onChange={(platform) => update({ platform })}
            onPreview={onPreview}
          />
        ) : null}
      </Section>

      <Section index={2} title="Racks">
        {free ? (
          <>
            <ChoiceGroup
              legend="Rack density"
              choices={densityChoices(config.platform)}
              value={String(config.density) as "4" | "8"}
              onChange={(density) => update({ density: Number(density) })}
              onPreview={onPreview}
              inline
            />
            <ChipPicker
              legend="Cabinet height"
              options={RACK_HEIGHTS}
              value={config.rackU}
              onChange={(rackU) => update({ rackU })}
              format={(u) => `${u}U`}
              note={rackNote(config.rackU)}
              focus="rack"
              onPreview={onPreview}
            />
          </>
        ) : null}
        <ChipPicker
          legend="Racks per row"
          options={ROW_LENGTHS}
          value={config.rowLength}
          onChange={(rowLength) => update({ rowLength })}
          note={`${stats.rows} row${stats.rows === 1 ? "" : "s"}`}
          focus="rack"
          onPreview={onPreview}
        />
        <Readouts
          items={[
            { label: "Compute racks", value: count(stats.computeRacks), detail: `${config.density} nodes each` },
            { label: "Network racks", value: count(stats.networkRacks), detail: "Switches, storage and management" },
          ]}
        />
      </Section>

      <Section index={3} title="Network">
        {free ? (
          <>
            <ChoiceGroup
              legend="GPU fabric"
              choices={FABRIC_CHOICES}
              value={config.fabric}
              onChange={(fabric) => update({ fabric })}
              onPreview={onPreview}
            />
            <ChoiceGroup
              legend="Topology"
              choices={TOPOLOGY_CHOICES}
              value={String(config.oversubscription) as "1" | "2"}
              onChange={(ratio) => update({ oversubscription: Number(ratio) })}
              onPreview={onPreview}
              inline
            />
          </>
        ) : null}
        <Readouts
          items={[
            {
              label: "Switches",
              value: `${stats.leaves} + ${stats.spines}`,
              detail: stats.spines ? "Leaves + spines, rail-optimized" : "One leaf, no spine needed",
            },
            {
              label: "Fabric links",
              value: count(stats.hostLinks + stats.uplinks),
              detail: `${count(stats.hostLinks)} rail, ${count(stats.uplinks)} uplink`,
            },
          ]}
        />
      </Section>

      <Section index={4} title="Storage">
        {free ? (
          <ChipPicker
            legend="Shared storage per node"
            options={STORAGE_PER_NODE}
            value={config.storagePerNode}
            onChange={(storagePerNode) => update({ storagePerNode })}
            format={storageLabel}
            note={config.storagePerNode ? capacityTb(config.storagePerNode * config.nodes) : "Local NVMe only"}
            focus="storage"
            onPreview={onPreview}
          />
        ) : null}
        <Readouts
          items={
            free
              ? [
                  {
                    label: "Storage nodes",
                    value: count(stats.storageTb / SUPPORT.nas.usableTb),
                    detail: `${SUPPORT.nas.usableTb} TB usable, ${SUPPORT.nas.uSize}U each`,
                  },
                  {
                    label: "Usable capacity",
                    value: stats.storageTb ? capacityTb(stats.storageTb) : "None",
                    detail: "All-flash NVMe, shared",
                  },
                ]
              : [
                  {
                    label: "Storage nodes",
                    value: count(model.racks.reduce((n, r) => n + r.parts.filter((p) => p.kind === "nas").length, 0)),
                    detail: "Sized to the configured platform",
                  },
                  {
                    label: "Capacity needed",
                    value: config.storagePerNode ? capacityTb(config.storagePerNode * config.nodes) : "None",
                    detail: "Shared, usable",
                  },
                ]
          }
        />
      </Section>
    </>
  );
}
