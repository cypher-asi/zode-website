/** Mock deployment sites for the network map. */
export type SiteStatus = "live" | "pipeline";

/** Compass side of the dot that a live site's code label sits on. */
export type LabelSide = "n" | "e" | "s" | "w";

export type Site = {
  id: string;
  city: string;
  lat: number;
  lng: number;
  mw: number;
  latencyMs?: number;
  status: SiteStatus;
  label?: LabelSide;
};

/** A site after projection, in map viewBox units. */
export type PlacedSite = Site & { x: number; y: number };

export const STATS = [
  { status: "live", value: "1", unit: "GW", label: "2027" },
  { status: "pipeline", value: "10", unit: "GW", label: "2028" },
] as const satisfies readonly { status: SiteStatus; value: string; unit: string; label: string }[];

export const SITES: readonly Site[] = [
  { id: "JNU-01", city: "Juneau, AK", lat: 58.3, lng: -134.42, mw: 4, latencyMs: 4, status: "live" },
  { id: "WRG-01", city: "Wrangell, AK", lat: 56.47, lng: -132.38, mw: 2, latencyMs: 5, status: "live" },
  { id: "KTN-01", city: "Ketchikan, AK", lat: 55.34, lng: -131.64, mw: 3, latencyMs: 4, status: "live" },
  { id: "YKA-01", city: "Kamloops, BC", lat: 50.67, lng: -120.33, mw: 5, latencyMs: 3, status: "live", label: "n" },
  { id: "YYC-01", city: "Calgary, AB", lat: 51.05, lng: -114.07, mw: 8, latencyMs: 3, status: "live", label: "n" },
  { id: "YQR-01", city: "Regina, SK", lat: 50.45, lng: -104.61, mw: 6, latencyMs: 4, status: "live" },
  { id: "YYZ-01", city: "Mississauga, ON", lat: 43.59, lng: -79.64, mw: 7, latencyMs: 2, status: "live" },
  { id: "SAC-01", city: "Sacramento, CA", lat: 38.58, lng: -121.49, mw: 11, latencyMs: 3, status: "live" },
  { id: "BIL-01", city: "Billings, MT", lat: 45.78, lng: -108.5, mw: 6, latencyMs: 4, status: "live" },
  { id: "CYS-01", city: "Cheyenne, WY", lat: 41.14, lng: -104.82, mw: 11, latencyMs: 3, status: "live" },
  { id: "BIS-01", city: "Bismarck, ND", lat: 46.81, lng: -100.78, mw: 8, latencyMs: 4, status: "live" },
  { id: "MCI-01", city: "Kansas City, MO", lat: 39.1, lng: -94.58, mw: 8, latencyMs: 3, status: "live" },
  { id: "DAL-01", city: "Dallas, TX", lat: 32.78, lng: -96.8, mw: 14, latencyMs: 2, status: "live" },
  { id: "HSV-01", city: "Huntsville, AL", lat: 34.73, lng: -86.59, mw: 7, latencyMs: 3, status: "live" },

  { id: "YEG-P", city: "Edmonton, AB", lat: 53.55, lng: -113.49, mw: 200, status: "pipeline" },
  { id: "SLC-P", city: "Salt Lake City, UT", lat: 40.76, lng: -111.89, mw: 250, status: "pipeline" },
  { id: "LAS-P", city: "Las Vegas, NV", lat: 36.17, lng: -115.14, mw: 160, status: "pipeline" },
  { id: "OMA-P", city: "Omaha, NE", lat: 41.26, lng: -95.93, mw: 180, status: "pipeline" },
  { id: "MSP-P", city: "Minneapolis, MN", lat: 44.98, lng: -93.27, mw: 180, status: "pipeline" },
  { id: "SAT-P", city: "San Antonio, TX", lat: 29.42, lng: -98.49, mw: 180, status: "pipeline" },
  { id: "OKC-P", city: "Oklahoma City, OK", lat: 35.47, lng: -97.52, mw: 220, status: "pipeline" },
  { id: "BNA-P", city: "Nashville, TN", lat: 36.16, lng: -86.78, mw: 200, status: "pipeline" },
  { id: "CLT-P", city: "Charlotte, NC", lat: 35.23, lng: -80.84, mw: 180, status: "pipeline" },
  { id: "YOW-P", city: "Ottawa, ON", lat: 45.42, lng: -75.7, mw: 250, status: "pipeline" },
];
