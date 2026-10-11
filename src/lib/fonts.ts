import { Inter, Newsreader } from "next/font/google";

/** Headline serif of the home page design, exposed as `--font-display`. */
export const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

/** Body sans of the home page design, exposed as `--font-text`. */
export const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});
