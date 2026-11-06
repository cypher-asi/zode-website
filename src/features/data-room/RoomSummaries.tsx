import { PortfolioSummaryView } from "./PortfolioSummaryView";
import type { LoadedSummary } from "./summary";
import { SummaryView } from "./SummaryView";
import { summaryKey } from "./tree";
import type { RoomSite } from "./types";
import type { RoomSummaries } from "./Viewer";

/**
 * A room's summaries rendered for its browser, by the folder each sits in.
 * `mapSrc` serves a site's satellite preview where the portal's own route can't.
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
          summary.layout === "portfolio" ? (
            <PortfolioSummaryView roomId={roomId} summary={summary} />
          ) : (
            <SummaryView
              roomId={roomId}
              summary={summary}
              mapSrc={summary.site && mapSrc ? mapSrc(summary.site) : undefined}
            />
          ),
      },
    ]),
  );
}
