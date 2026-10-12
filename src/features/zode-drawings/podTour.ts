export type PodId = "compute" | "electrical" | "cooling";

export interface Hotspot {
  /** Matches the `zone` of the drawing layers it highlights (see CabinArt.tsx). */
  id: string;
  title: string;
  body: string;
  /** Hidden under the roof, so highlighting it lifts the roof off (see CabinArt's cutaway). */
  overhead?: boolean;
}

export interface PodTour {
  id: PodId;
  label: string;
  title: string;
  summary: string;
  /** Equipment inside this pod, listed before the shared shell hotspots. */
  hotspots: readonly Hotspot[];
}

/** The cabin, deck and fiber routes every pod shares. */
export const SHELL_HOTSPOTS: readonly Hotspot[] = [
  {
    id: "roof",
    title: "Insulated gable roof",
    body: "Standing-seam panels over a factory-insulated shell hold the hall steady from −40 to 115 °F.",
  },
  {
    id: "facade",
    title: "Steel frame + glazing",
    body: "A welded steel frame with full-height glazing, built and tested in the factory before it ships.",
  },
  {
    id: "noc",
    title: "Operations room",
    body: "A glass-walled NOC by the entrance, sealed off from the hall's heat and noise, with the whole floor in view.",
  },
  {
    id: "deck",
    title: "Entrance deck",
    body: "One secure entry for technicians, with the service deck built into the pod's footprint.",
  },
  {
    id: "fiber-a",
    title: "Fiber route A",
    body: "A diverse path west: its own conduit, entry and carrier, so a single cut never takes the pod offline.",
  },
  {
    id: "fiber-b",
    title: "Fiber route B",
    body: "A diverse path east, in a separate conduit from A. Traffic flows both ways on both routes, all the time.",
  },
];

/** In selector order. */
export const POD_TOURS: readonly PodTour[] = [
  {
    id: "compute",
    label: "Compute",
    title: "Compute Pod",
    summary: "Ten liquid-cooled racks with rear-door heat exchangers, A/B busways and segregated fiber.",
    hotspots: [
      {
        id: "racks",
        title: "GPU racks",
        body: "Eight liquid-cooled compute racks, direct-to-chip cooled and fed from redundant A/B busways.",
      },
      {
        id: "spine",
        title: "Network spine",
        body: "Two central racks carry the InfiniBand fabric and patch both fiber routes into every node.",
      },
      {
        id: "coolant",
        title: "Coolant distribution",
        body: "A CDU feeds overhead supply and return headers that drop to each rack's cold plates and rear-door heat exchanger.",
        overhead: true,
      },
      {
        id: "busways",
        title: "A/B busways",
        body: "Two overhead 1,250 A busways run the row, and every rack draws from both through its own tap-off boxes.",
        overhead: true,
      },
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    title: "Electrical Pod",
    summary: "2 MVA transformer, 3,200 A switchboard and protected UPS power for the whole ZODE.",
    hotspots: [
      {
        id: "transformer",
        title: "2 MVA transformer",
        body: "A dry-type transformer steps utility medium voltage down for every pod in the ZODE.",
      },
      {
        id: "fans",
        title: "Ventilation fans",
        body: "Wall-mounted fans pull heat off the transformer windings and out of the hall.",
      },
      {
        id: "switchboard",
        title: "3,200 A switchboard",
        body: "Low-voltage switchgear splits power into the independent A and B feeds for every rack.",
      },
      {
        id: "ups",
        title: "UPS + battery",
        body: "100 kW of battery-backed UPS rides through outages and keeps controls and network alive.",
      },
    ],
  },
  {
    id: "cooling",
    label: "Cooling",
    title: "Cooling Pod",
    summary: "Duty and standby pumps, heat exchanger and buffer storage for the warm and chilled-water loops.",
    hotspots: [
      {
        id: "tanks",
        title: "Buffer tanks",
        body: "Two 3,785 L tanks add thermal mass, smoothing load swings across both water loops.",
      },
      {
        id: "pumps",
        title: "Pump skids",
        body: "Duty and standby pumps on each loop, N+1, with their drive controls, so maintenance never stops the flow.",
      },
      {
        id: "hx",
        title: "Plate heat exchanger",
        body: "Keeps the rack loop separate from the outdoor dry-cooler loop while moving heat between them.",
      },
      {
        id: "headers",
        title: "Loop headers",
        body: "Warm and chilled-water headers tie the pumps, tanks and exchanger to the compute pod.",
      },
    ],
  },
];
