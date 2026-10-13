import { Geist, Inter } from "next/font/google";

/** Headline sans, exposed as `--font-geist` (aliased to `--font-display` in globals.css). */
export const display = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

/** Body sans, exposed as `--font-text` (aliased to `--font-sans` in globals.css). */
export const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});
