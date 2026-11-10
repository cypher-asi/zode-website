import { DeploymentSummaryView } from "./DeploymentSummaryView";
import { MasterSummaryView } from "./MasterSummaryView";
import type { LoadedSummary } from "./summary";
import { SummaryView } from "./SummaryView";
import { summaryKey } from "./tree";
import type { RoomSite } from "./types";
import type { RoomLink, RoomSummaries } from "./Viewer";

/** The live deck, so a room never holds a copy that falls behind it. */
const DECK: RoomLink = { name: "Deck", href: "/deck" };

/**
 * A room's summaries rendered for its browser, by the folder each sits in.
 * A company summary at the top of the room is followed by the investor deck.
 * `mapSrc` serves a site's satellite preview where the portal's own route
 * can't.
 */
export function renderSummaries(
  roomId: string,
  summaries: LoadedSummary[],
  mapSrc?: (site: RoomSite) => string | null,
): RoomSummaries {
  return Object.fromEntries(
    summaries.map((summary) => [
      summaryKey(summary.folderId),
      {
        content:
          summary.layout === "master" ? (
            <MasterSummaryView roomId={roomId} summary={summary} />
          ) : summary.layout === "deployment" ? (
            <DeploymentSummaryView roomId={roomId} summary={summary} />
          ) : (
            <SummaryView
              roomId={roomId}
              summary={summary}
              mapSrc={summary.site && mapSrc ? mapSrc(summary.site) : undefined}
            />
          ),
        links: summary.layout === "master" && summary.folderId === null ? [DECK] : [],
      },
    ]),
  );
}
