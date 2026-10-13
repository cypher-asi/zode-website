import { monogramImage } from "@/lib/monogramImage";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

// iOS rounds the corners, so the Z sits narrower than in the favicon.
export default function AppleIcon() {
  return monogramImage(size, 0.62);
}
