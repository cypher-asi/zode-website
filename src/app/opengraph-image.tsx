import { monogramImage } from "@/lib/monogramImage";

export const alt = "ZODE";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpengraphImage() {
  return monogramImage(size, 0.3);
}
