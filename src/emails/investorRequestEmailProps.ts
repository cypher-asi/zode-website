import { checkSizeLabel, investorTypeLabel, opportunityLabel } from "@/features/investor-request/options";
import type { InvestorRequestEmailProps } from "./InvestorRequestNotification";

/** Minimal shape of a stored request, so the /dev/emails preview needn't import server-only code. */
interface RequestFields {
  investorType: string;
  opportunities: readonly string[];
  checkSize: string;
  name: string;
  email: string;
  firm: string;
  title: string;
  firmWebsite: string;
  phone: string;
  note: string;
}

const PLACED_AT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/** An Invest inquiry as the plain strings its email shows. */
export function investorRequestEmailProps(
  request: RequestFields,
  reference: string,
  placedAt = new Date(),
): InvestorRequestEmailProps {
  return {
    reference,
    placedAt: `${PLACED_AT.format(placedAt)} UTC`,
    investorType: investorTypeLabel(request.investorType),
    opportunities: request.opportunities.map(opportunityLabel).join(" and "),
    checkSize: checkSizeLabel(request.checkSize),
    name: request.name,
    email: request.email,
    firm: request.firm,
    title: request.title,
    firmWebsite: request.firmWebsite,
    phone: request.phone,
    note: request.note,
  };
}
