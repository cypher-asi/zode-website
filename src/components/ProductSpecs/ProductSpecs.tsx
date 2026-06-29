import type { ReactElement } from "react";
import styles from "./ProductSpecs.module.css";

interface SpecItem {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

interface SpecGroup {
  readonly title: string;
  readonly items: readonly SpecItem[];
}

const GROUPS: readonly SpecGroup[] = [
  {
    title: "Compute & Networking",
    items: [
      { label: "GPUs", value: "720 NVIDIA B300" },
      { label: "Racks", value: "12 liquid-cooled" },
      { label: "Rack Density", value: "125 kW" },
      { label: "Fabric", value: "400G InfiniBand" },
    ],
  },
  {
    title: "Power",
    items: [
      { label: "Capacity", value: "1.5 MW dispatchable" },
      { label: "Source", value: "Grid + solar + storage" },
      { label: "PUE", value: "< 1.1", note: "1" },
      { label: "Backup", value: "On-site battery (BESS)" },
    ],
  },
  {
    title: "Cooling",
    items: [
      { label: "Method", value: "Direct-to-chip liquid" },
      { label: "Heat Rejection", value: "Closed-loop dry cooler" },
      { label: "Water Use (WUE)", value: "~0 L/kWh" },
    ],
  },
  {
    title: "Deployment",
    items: [
      { label: "Lead Time", value: "12 weeks" },
      { label: "Assembly", value: "Site-assembled" },
      { label: "Mobility", value: "Relocatable" },
    ],
  },
];

const DIMENSIONS: readonly SpecItem[] = [
  { label: "Footprint", value: "50 x 24 ft" },
  { label: "Square Footage", value: "1,200 sq ft" },
  { label: "Height", value: "24 ft" },
  { label: "Interior Volume", value: "~28,800 cu ft" },
  { label: "Weight", value: "~38,000 lbs" },
  { label: "Form Factor", value: "ISO-modular" },
];

const WARRANTY: readonly SpecItem[] = [
  { label: "Coverage", value: "3 years, full system" },
  { label: "Support", value: "24/7 remote NOC" },
];

/**
 * Grouped specification table for ZODE One: label-over-value cells in
 * category bands separated by hairline rules, with a unit photo carrying
 * dimension callouts and a warranty block, closing the marketing page.
 */
export function ProductSpecs(): ReactElement {
  return (
    <section className={styles.specs} aria-label="ZODE One specifications">
      <div className={styles.inner}>
        <h2 className={styles.heading}>ZODE One Specs</h2>

        <div className={`${styles.group} ${styles.dimensionsGroup}`}>
          <h3 className={styles.groupTitle}>Dimensions</h3>
          <div className={styles.dimensionsLayout}>
            <dl className={styles.grid}>
              {DIMENSIONS.map((item) => (
                <SpecCell key={item.label} item={item} />
              ))}
            </dl>
            <figure className={styles.unit}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.unitImage}
                src="/images/zode-cabin-wireframe.png"
                alt="ZODE One micro-data center unit wireframe"
              />
              <span className={`${styles.callout} ${styles.calloutLength}`}>
                50 ft
              </span>
              <span className={`${styles.callout} ${styles.calloutWidth}`}>
                24 ft
              </span>
              <span className={`${styles.callout} ${styles.calloutHeight}`}>
                24 ft
              </span>
            </figure>
          </div>
        </div>

        <div className={styles.groupColumns}>
          {GROUPS.map((group) => (
            <div key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <dl className={styles.grid}>
                {group.items.map((item) => (
                  <SpecCell key={item.label} item={item} />
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Warranty</h3>
          <dl className={styles.grid}>
            {WARRANTY.map((item) => (
              <SpecCell key={item.label} item={item} />
            ))}
          </dl>
          <a className={styles.link} href="/warranty">
            See Details
          </a>
        </div>

        <p className={styles.footnote}>
          <sup>1</sup> Power usage effectiveness measured at full IT load under
          nominal ambient conditions. Specifications are representative and may
          vary by site configuration.
        </p>
      </div>
    </section>
  );
}

function SpecCell({ item }: { readonly item: SpecItem }): ReactElement {
  return (
    <div className={styles.cell}>
      <dt className={styles.cellLabel}>
        {item.label}
        {item.note ? <sup className={styles.refMarker}>{item.note}</sup> : null}
      </dt>
      <dd className={styles.cellValue}>{item.value}</dd>
    </div>
  );
}
