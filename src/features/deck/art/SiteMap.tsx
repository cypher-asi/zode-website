import type { ReactElement } from "react";
import { SITE_MAPS, type SiteMapId } from "./siteMaps";
import styles from "./SiteMap.module.css";

/** The 200 × 200 box siteMaps.ts is drawn in, the city's centre in the middle. */
const VIEW = 200;

/**
 * A city's streets, rail and water around its centre, in line, cropped to
 * fill whatever box it's given; a dot marks the centre. The site's own
 * address isn't shown.
 */
export function SiteMap({ id }: { id: SiteMapId }): ReactElement {
  const map = SITE_MAPS[id];
  return (
    <svg className={styles.map} viewBox={`0 0 ${VIEW} ${VIEW}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path className={styles.water} d={map.water} />
      <path className={styles.waterway} d={map.waterways} />
      <path className={styles.minor} d={map.minor} />
      <path className={styles.arterial} d={map.arterial} />
      <path className={styles.rail} d={map.rail} />
      <path className={styles.major} d={map.major} />
      <circle className={styles.halo} cx={VIEW / 2} cy={VIEW / 2} r={9} />
      <circle className={styles.site} cx={VIEW / 2} cy={VIEW / 2} r={5} />
    </svg>
  );
}
