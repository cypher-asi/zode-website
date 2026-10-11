import { DEFAULT_CONFIG } from "../app/buy-compute/config";
import { DEFAULT_RENT_CONFIG } from "../app/buy-compute/rentConfig";
import { accountEmailProps } from "./accountEmailProps";
import { engineerRequestEmailProps } from "./engineerRequestEmailProps";
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

export const PREVIEW_ENGINEER = engineerRequestEmailProps(
  {
    interests: ["buy", "rent"],
    deploymentSize: "64-256",
    name: "Ada Lovelace",
    title: "Head of Infrastructure",
    company: "analyticalengines.com",
    phone: "+1 (555) 010-1843",
    email: "ada@example.com",
  },
  "5C20E7D1",
  placedAt,
);

export const PREVIEW_ACCOUNT = accountEmailProps(
  { userId: "b7e1c2d4-0f3a-4a8e-9c61-2d5f7a9e4b10", email: "ada@example.com", displayName: "Ada Lovelace", primaryZid: "0://ada" },
  "",
  placedAt,
);

/** The preview server can't resolve the `cid:` attachment that sent mail uses. */
export const PREVIEW_LOGO = `data:image/png;base64,${WORDMARK_PNG_BASE64}`;
