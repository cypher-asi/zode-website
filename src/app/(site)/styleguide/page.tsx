import type { Metadata } from "next";
import { Styleguide } from "@/features/styleguide/Styleguide";

export const metadata: Metadata = {
  title: "Agent Styleguide | ZODE",
  description:
    "The ZODE brand system and press kit: voice, logo, colour, type, layout and imagery, published for people and AI agents.",
  alternates: {
    canonical: "/styleguide",
    types: { "text/markdown": "/styleguide.md" },
  },
};

export default function StyleguidePage() {
  return <Styleguide />;
}
