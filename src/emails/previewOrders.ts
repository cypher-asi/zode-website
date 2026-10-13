import { DEFAULT_CONFIG } from "@/features/configurator/buyConfig";
import { DEFAULT_RENT_CONFIG } from "@/features/configurator/rentConfig";
import { accountEmailProps } from "./accountEmailProps";
import { engineerRequestEmailProps } from "./engineerRequestEmailProps";
import { investorRequestEmailProps } from "./investorRequestEmailProps";
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

export const PREVIEW_INVESTOR = investorRequestEmailProps(
  {
    investorType: "infrastructure",
    opportunities: ["equity", "project"],
    checkSize: "5m-25m",
    name: "Ada Lovelace",
    email: "ada@example.com",
    firm: "Analytical Capital",
    title: "Partner",
    firmWebsite: "analyticalcapital.com",
    phone: "+1 (555) 010-1843",
    note: "We back energy and compute infrastructure. Keen to see unit economics per deployment.",
  },
  "9E41B2C7",
  placedAt,
);

export const PREVIEW_ACCOUNT = accountEmailProps(
  { userId: "b7e1c2d4-0f3a-4a8e-9c61-2d5f7a9e4b10", email: "ada@example.com", displayName: "Ada Lovelace", primaryZid: "0://ada" },
  "",
  placedAt,
);

export const PREVIEW_DATA_ROOM_INVITE = {
  roomName: "Project Atlas",
  inviterName: "Ada Lovelace",
  inviterEmail: "ada@example.com",
  roleLabel: "Viewer",
  inviteUrl: "https://zode.org/data-rooms/invite/preview-token",
  expiresOn: "October 25, 2026",
  requiresMnda: true,
};

export const PREVIEW_TEAM_INVITE = {
  inviterName: "Ada Lovelace",
  inviterEmail: "ada@example.com",
  inviteUrl: "https://zode.org/invite/preview-token",
  expiresOn: "October 25, 2026",
};

export const PREVIEW_MNDA = {
  agreementId: "3f1c2a9e-8b7d-4c1e-9f2a-1b2c3d4e5f60",
  entityName: "Acme Robotics, Inc.",
  entityType: "Delaware corporation",
  signerName: "Grace Hopper",
  signerTitle: "Chief Executive Officer",
  signerEmail: "grace@example.com",
  zodeSignerName: "Ada Lovelace",
  zodeSignerTitle: "Chief Executive Officer",
  effectiveDate: "October 11, 2026",
  roomName: "Project Atlas",
};

/** The preview server can't resolve the `cid:` attachment that sent mail uses. */
export const PREVIEW_LOGO = `data:image/png;base64,${WORDMARK_PNG_BASE64}`;
