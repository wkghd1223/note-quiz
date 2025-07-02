import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Note Quiz";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          🎵 Note Quiz
        </div>
        <div
          style={{
            fontSize: 32,
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Learn to read musical notes by sight and sound!
        </div>
        <div
          style={{
            fontSize: 24,
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center",
            marginTop: 30,
          }}
        >
          🎹 Piano • 🎵 Solfege • 🎼 Staff Notation
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
