import type { ReactElement } from "react";
import { BORDER_PATH, GRATICULE_PATH, LAND_PATH, LINKS, PLACED_SITES, VIEW } from "./naMap";
import { NetworkMap } from "./NetworkMap";

/** Server half of the network section: hands pre-projected geometry to the client map. */
export function Network(): ReactElement {
  return (
    <NetworkMap
      view={VIEW}
      land={LAND_PATH}
      borders={BORDER_PATH}
      graticule={GRATICULE_PATH}
      sites={PLACED_SITES}
      links={LINKS}
    />
  );
}
