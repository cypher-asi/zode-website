import { ImageResponse } from "next/og";
import { MONOGRAM_PATH, MONOGRAM_VIEWBOX } from "@/lib/brandMarks";

/**
 * The white Z monogram centred on ink, rendered to a PNG for the generated
 * favicon, Apple touch icon, and link-preview image. `markWidth` is the Z's
 * width as a fraction of the image's width.
 */
export function monogramImage(size: { width: number; height: number }, markWidth: number): ImageResponse {
  const width = size.width * markWidth;
  const height = (width * MONOGRAM_VIEWBOX.height) / MONOGRAM_VIEWBOX.width;
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0c0c0d",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${MONOGRAM_VIEWBOX.width} ${MONOGRAM_VIEWBOX.height}`}>
          <path d={MONOGRAM_PATH} fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
