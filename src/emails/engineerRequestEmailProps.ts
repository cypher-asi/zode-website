import { interestLabel, sizeLabel } from "../app/(site)/talk-to-an-engineer/options";
import type { EngineerRequestEmailProps } from "./EngineerRequestNotification";

/** Minimal shape of a stored request, so the /dev/emails preview needn't import server-only code. */
interface RequestFields {
  interests: readonly string[];
  deploymentSize: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
}

const PLACED_AT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

/** A Talk to an Engineer request as the plain strings its email shows. */
export function engineerRequestEmailProps(
  request: RequestFields,
  reference: string,
  placedAt = new Date(),
): EngineerRequestEmailProps {
  return {
    reference,
    placedAt: `${PLACED_AT.format(placedAt)} UTC`,
    interests: request.interests.map(interestLabel).join(" and "),
    deploymentSize: sizeLabel(request.deploymentSize),
    name: request.name,
    title: request.title,
    company: request.company,
    phone: request.phone,
    email: request.email,
  };
}
