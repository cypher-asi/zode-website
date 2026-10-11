import { DEFAULT_CONFIG } from "../app/buy-compute/config";
import { DEFAULT_RENT_CONFIG } from "../app/buy-compute/rentConfig";
import { orderEmailProps } from "./orderEmailProps";
import { WORDMARK_PNG_BASE64 } from "./wordmark";

/** Sample orders for the /dev/emails preview, priced from the configurator defaults. */
const contact = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "Analytical Engines",
  notes: "Looking to bring the first racks online next quarter. Site has 3 MW available.",
};

const placedAt = new Date("2026-10-11T19:30:00Z");

export const PREVIEW_BUY = orderEmailProps({ mode: "buy", config: DEFAULT_CONFIG, contact }, "3F9A1C2E", placedAt);

export const PREVIEW_RENT = orderEmailProps(
  { mode: "rent", config: DEFAULT_RENT_CONFIG, contact },
  "B71D04A9",
  placedAt,
);

/** The preview server can't resolve the `cid:` attachment that sent mail uses. */
export const PREVIEW_LOGO = `data:image/png;base64,${WORDMARK_PNG_BASE64}`;
