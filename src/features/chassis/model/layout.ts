import type { DesignData } from "@/features/chassis/model/schema";
import type { Derived } from "@/features/chassis/model/calc";
import { pad2 } from "@/features/chassis/model/format";

export interface RailItem {
  kind: "tap" | "feed";
  /** Interior x from the inner end wall, mm. */
  x: number;
  l: number;
  label: string;
  rackId?: string;
}

export interface Rail {
  id: "A" | "B";
  /** Across-pod position of the bus centreline, mm from the inner front wall. */
  y: number;
  items: RailItem[];
}

/** Busway tap / end-feed packing. A feeds from the left end, B from the right, centred in the clear length. */
export function railLayout(data: DesignData, d: Derived): Rail[] {
  const sec = data.racks.section;
  const n = d.racks.length;
  const start = (d.geometry.clearL - d.geometry.tapRail) / 2;
  const pitch = sec.tap.l + sec.tap.gap;
  const taps = (x0: number, id: string): RailItem[] =>
    d.racks.map((r, i) => ({
      kind: "tap",
      x: x0 + i * pitch,
      l: sec.tap.l,
      label: `${pad2(i + 1)}${id}`,
      rackId: r.id,
    }));
  const tapsLen = n * sec.tap.l + Math.max(0, n - 1) * sec.tap.gap;
  return [
    {
      id: "A",
      y: sec.busA.y,
      items: [
        { kind: "feed", x: start, l: sec.feed.l, label: "FEED" },
        ...taps(start + sec.feed.l + sec.feed.gap, "A"),
      ],
    },
    {
      id: "B",
      y: sec.busB.y,
      items: [...taps(start, "B"), { kind: "feed", x: start + tapsLen + sec.feed.gap, l: sec.feed.l, label: "FEED" }],
    },
  ];
}
