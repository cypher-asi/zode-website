import { Inter, Newsreader } from "next/font/google";

/** Headline serif, exposed as `--font-display` (aliased to `--font-serif` in globals.css). */
export const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

/** Body sans, exposed as `--font-text` (aliased to `--font-sans` in globals.css). */
export const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});
