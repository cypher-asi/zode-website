import { Inter } from "next/font/google";
import localFont from "next/font/local";

/**
 * Headline face: DISPLAY_FONT in features/styleguide/brand.ts, whose files
 * scripts/fetch-display-font.mjs keeps in assets/fonts/display. Exposed as
 * `--font-display-face` (aliased to `--font-display` in globals.css).
 */
export const display = localFont({
  src: [
    { path: "../assets/fonts/display/light.woff2", weight: "300" },
    { path: "../assets/fonts/display/regular.woff2", weight: "400" },
  ],
  variable: "--font-display-face",
});

/** Body sans, exposed as `--font-text` (aliased to `--font-sans` in globals.css). */
export const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});
