import { ImageResponse } from "next/og";
import { MONOGRAM_PATH } from "@/lib/brandMarks";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
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
        <svg width={24} height={15.5} viewBox="0 0 645 417">
          <path d={MONOGRAM_PATH} fill="#ffffff" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
