import type { PortalIconName } from "../../portal/icons";

/*
 * The factory's main flows, in the order material moves through them: the
 * Factory app's sidebar, and the outline each one is designed against.
 * Inbound is designed and simulated in full; the rest carry their outline
 * until their turn.
 */

export type FlowId = "overview" | "inbound" | "kitting" | "assembly" | "test" | "outbound";

export interface FactoryFlow {
  id: FlowId;
  label: string;
  href: string;
  icon: PortalIconName;
  summary: string;
  /** Designed and simulated step by step, with its own page. */
  built: boolean;
  outline: readonly { title: string; detail: string }[];
}

export const FACTORY_FLOWS: readonly FactoryFlow[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/portal/factory",
    icon: "factory",
    summary: "The whole floor in 3D: the line, its stations, the store and the yard.",
    built: true,
    outline: [],
  },
  {
    id: "inbound",
    label: "Inbound & receiving",
    href: "/portal/factory/inbound",
    icon: "truck",
    summary: "From purchase order to the shelf: appointments, the gate, the doors, checks, QC and put-away.",
    built: true,
    outline: [],
  },
  {
    id: "kitting",
    label: "Store & kitting",
    href: "/portal/factory/kitting",
    icon: "rooms",
    summary: "The parts store and the kits it sends down the aisle to each station.",
    built: false,
    outline: [
      {
        title: "Locations",
        detail:
          "Secure cage for racks, racking for busways, headers, trays and panels, the steel lane for frames, roofs, posts and rails. Every location labelled; first in, first out by receipt date.",
      },
      {
        title: "Pick signal",
        detail:
          "A station's kit pad empties and calls its next kit, as the simulation does today; later a kanban paced to takt, so kits don't pile up line-side.",
      },
      {
        title: "Pick by license plate",
        detail:
          "Each station's kit from the pod's bill: S1 a base frame, S2 six posts and four rails, S3 eight compute and two network racks, and on. Picked by LPN so every serial follows its pod.",
      },
      {
        title: "Carts and fixtures",
        detail:
          "A cart or fixture per station's kit: rack carts for S3, a busway cradle for S4, spool racks for S5. Frames and roofs go by the hall crane.",
      },
      {
        title: "Delivery",
        detail: "A milk run down the centre aisle: a full cart left on the pad, the empty one brought back.",
      },
      {
        title: "Counts",
        detail: "Cycle counts by zone, the cage every week; differences investigated before the next reorder.",
      },
    ],
  },
  {
    id: "assembly",
    label: "Pod assembly",
    href: "/portal/factory/assembly",
    icon: "cluster",
    summary: "Stations S1 to S8, building the compute pod on the line.",
    built: false,
    outline: [
      {
        title: "Takt",
        detail:
          "One pod per release interval; each station's standard work fits inside it, or the line has a bottleneck.",
      },
      {
        title: "Standard work",
        detail: "Per station: the sequence, the crew, the tools and torques, and the crane lifts at S1 and S8.",
      },
      {
        title: "Quality gates",
        detail: "Before a pod moves on: torque audit, a visual check, photos into the pod's record.",
      },
      {
        title: "Moves",
        detail: "Pods on skates or air casters from bay to bay; the buffer lanes absorb the spread in cycle times.",
      },
      {
        title: "Andon",
        detail: "Any station can stop the line; problems are fixed in station, not passed on.",
      },
      {
        title: "Traveller",
        detail: "One digital record per pod: every part by LPN, every step signed, every reading.",
      },
    ],
  },
  {
    id: "test",
    label: "Test & commissioning",
    href: "/portal/factory/test",
    icon: "pulse",
    summary: "S9: proving each pod runs at full power and cooling before it ships.",
    built: false,
    outline: [
      {
        title: "Hook-up",
        detail: "Shore power and a chilled water loop on quick connects; fill, vent and leak test the cooling circuit.",
      },
      {
        title: "Power-on",
        detail: "Energise the busways, then each rack's power shelves; bring up every BMC.",
      },
      {
        title: "Network",
        detail: "Fiber continuity and loss, switch configuration, link tests across every port.",
      },
      {
        title: "Burn-in",
        detail: "Compute load at rated power and cooling for a set soak, with a thermal map of the pod.",
      },
      {
        title: "Punch list",
        detail: "Faults fixed in place and retested; about one pod in ten in the simulation.",
      },
      {
        title: "Acceptance",
        detail: "Factory acceptance test with the customer, sign-off and the pod's certificate.",
      },
    ],
  },
  {
    id: "outbound",
    label: "Outbound & shipping",
    href: "/portal/factory/outbound",
    icon: "outbound",
    summary: "From the yard to the customer's site.",
    built: false,
    outline: [
      {
        title: "Prep",
        detail: "Final clean, openings sealed, shock and tilt indicators fitted, weatherproof wrap.",
      },
      {
        title: "Yard",
        detail: "Finished pods wait in the outbound yard, three slots in today's floor plan.",
      },
      {
        title: "Transport",
        detail:
          "A step-deck or lowboy trailer: a pod is 6.1 m by 2.4 m by 3.4 m, over legal height on a standard deck, so routes and permits are planned.",
      },
      {
        title: "Load-out",
        detail: "Crane lift onto the trailer, tie-downs to the plan, a check before it leaves.",
      },
      {
        title: "Papers",
        detail: "BOL, a packing list with every serial by LPN, and the commercial invoice.",
      },
      {
        title: "Delivery",
        detail: "Booked with the site, tracked in transit, and closed with proof of delivery.",
      },
    ],
  },
];

export const flowById = (id: string): FactoryFlow | undefined => FACTORY_FLOWS.find((f) => f.id === id);
