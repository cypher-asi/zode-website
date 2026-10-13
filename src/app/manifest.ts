import type { MetadataRoute } from "next";
import { brandColor } from "@/features/styleguide/brand";
import { APP_ICON_SIZES } from "@/lib/appIcon";

/** Installs the portal as a home-screen app, opening straight into it without the browser's chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/portal",
    name: "ZODE Portal",
    short_name: "ZODE",
    description: "Your ZODE data rooms, orders and contracts.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brandColor("--color-white"),
    theme_color: brandColor("--color-white"),
    icons: [
      ...APP_ICON_SIZES.map((size) => ({
        src: `/app-icon/${size}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any" as const,
      })),
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
