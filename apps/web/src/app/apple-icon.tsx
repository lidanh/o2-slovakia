import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0112AA",
          borderRadius: 34,
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: "50%",
            border: "20px solid white",
            boxSizing: "border-box",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
