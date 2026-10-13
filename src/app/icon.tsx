import { monogramImage } from "@/lib/monogramImage";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return monogramImage(size, 0.75);
}
