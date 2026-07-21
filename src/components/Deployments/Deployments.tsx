"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEPLOYMENTS,
  GROUPED_CATEGORIES,
  TAB_LABELS,
  TAB_ORDER,
  isCategory,
  parseDeploymentTab,
  sectionPowerMeta,
  slotsForCategory,
  type Deployment,
  type DeploymentSlot,
  type DeploymentTab,
} from "@/content/deployments";
import styles from "./Deployments.module.css";

function ExternalLinkIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function isAssemblyTopRule(
  prev: DeploymentSlot | undefined,
  slot: DeploymentSlot,
): boolean {
  return prev != null && slot.label.toLowerCase() === "assembly";
}

function SlotTable({ slots }: { slots: readonly DeploymentSlot[] }): ReactElement {
  if (slots.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Description</th>
              <th>Mfr</th>
              <th>SKU</th>
              <th className={styles.qty}>Qty</th>
              <th className={styles.oem}>OEM</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>No slots yet</p>
                  <p className={styles.emptyHint}>
                    This section has no line items configured.
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "14%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Description</th>
            <th>Mfr</th>
            <th>SKU</th>
            <th className={styles.qty}>Qty</th>
            <th className={styles.oem}>OEM</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => (
            <tr
              key={slot.id}
              className={
                isAssemblyTopRule(slots[i - 1], slot)
                  ? styles.assemblyRule
                  : undefined
              }
            >
              <td className={styles.slot}>{slot.label}</td>
              <td>{slot.description ?? "—"}</td>
              <td>{slot.manufacturer ?? "—"}</td>
              <td className={styles.sku}>{slot.sku ?? "—"}</td>
              <td className={styles.qty}>{slot.quantity}</td>
              <td className={styles.oem}>
                {slot.oemUrl ? (
                  <a
                    className={styles.oemLink}
                    href={slot.oemUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={slot.oemUrl}
                    aria-label={`Open OEM link for ${slot.label}`}
                  >
                    <ExternalLinkIcon />
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPanel({
  deployment,
  tab,
}: {
  deployment: Deployment;
  tab: DeploymentTab;
}): ReactElement {
  if (tab === "Simulation") {
    return (
      <div className={styles.tableWrap}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Rack simulation</p>
          <p className={styles.emptyHint}>
            3D rack simulation is not available on this page yet.
          </p>
        </div>
      </div>
    );
  }

  if (tab === "DataCenter") {
    return (
      <SlotTable slots={[]} />
    );
  }

  const slots = slotsForCategory(deployment, tab);
  const grouped = GROUPED_CATEGORIES.includes(tab);

  if (!grouped) {
    return <SlotTable slots={slots} />;
  }

  const groups: (string | null)[] = [];
  for (const s of slots) {
    const g = s.group ?? null;
    if (!groups.includes(g)) groups.push(g);
  }

  if (groups.length === 0) {
    return <SlotTable slots={[]} />;
  }

  return (
    <div>
      {groups.map((group) => {
        const rows = slots.filter((s) => (s.group ?? null) === group);
        return (
          <div key={group ?? "default"} className={styles.groupBlock}>
            {group ? <h3 className={styles.groupTitle}>{group}</h3> : null}
            <SlotTable slots={rows} />
          </div>
        );
      })}
    </div>
  );
}

export function DeploymentsView({
  deployment,
}: {
  deployment: Deployment;
}): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseDeploymentTab(searchParams.get("tab"));

  function setTab(tab: DeploymentTab): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab.toLowerCase());
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const section = isCategory(activeTab)
    ? deployment.sections.find((s) => s.category === activeTab)
    : undefined;
  const powerMeta = section ? sectionPowerMeta(section) : null;

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Deployments">
        <p className={styles.sidebarTitle}>Deployments</p>
        <ul className={styles.list}>
          {DEPLOYMENTS.map((item) => {
            const active = item.id === deployment.id;
            const href =
              activeTab === "Gpu"
                ? `/deployments/${item.id}`
                : `/deployments/${item.id}?tab=${activeTab.toLowerCase()}`;
            const nodes =
              item.sections.find((s) => s.category === "Gpu")?.nodeCount ?? "—";
            return (
              <li key={item.id} className={styles.listItem}>
                <Link
                  href={href}
                  className={`${styles.listLink} ${active ? styles.listLinkActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles.listMain}>
                    <span className={styles.listName}>{item.name}</span>
                    <span className={styles.listMeta}>
                      {item.region} · {item.targetDate}
                    </span>
                    <span className={styles.listMeta}>{item.availability}</span>
                  </span>
                  <span className={styles.badge}>{nodes}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className={styles.main}>
        <div className={styles.tabs} role="tablist" aria-label="Sections">
          {TAB_ORDER.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                onClick={() => setTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>{TAB_LABELS[activeTab]}</h1>
          {isCategory(activeTab) ? (
            <>
              <p className={styles.subtitle}>
                {section?.nodeName ? (
                  <>
                    <span className={styles.subtitleStrong}>
                      {section.nodeName}
                    </span>
                    {section.nodeSku ? (
                      <span className={styles.skuLabel}>{section.nodeSku}</span>
                    ) : null}
                  </>
                ) : (
                  "No node configured"
                )}
              </p>
              {powerMeta ? (
                <p className={styles.powerMeta}>{powerMeta}</p>
              ) : null}
            </>
          ) : activeTab === "DataCenter" ? (
            <p className={styles.subtitle}>Facility and site details</p>
          ) : (
            <p className={styles.subtitle}>Interactive rack layout</p>
          )}
        </header>

        <TabPanel deployment={deployment} tab={activeTab} />
      </div>
    </div>
  );
}
