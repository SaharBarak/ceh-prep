import { ImageResponse } from "next/og";

/**
 * Default homepage Open Graph + Twitter card image.
 *
 * Next 15 file convention: `opengraph-image.tsx` in `src/app/` produces
 * the OG image for `/`. Per-route variants live alongside their pages
 * (e.g. `src/app/(app)/course/[day]/opengraph-image.tsx`).
 *
 * Visual: brand-on-brand. Zinc-950 bg, lime accent on the action word,
 * mono detail line at the bottom. No external font fetch — we rely on
 * Vercel's edge font stack so the image stays fast + reliable.
 */

export const alt = "CEH Prep — pass CEH v13 in 14 days, browser-only lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function HomepageOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0c",
          color: "#f4f4f5",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: "#f4f4f5",
            }}
          >
            CEH Prep
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#52525b",
            }}
          >
            v13
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
              color: "#f4f4f5",
              maxWidth: 1000,
              display: "flex",
              flexWrap: "wrap",
              gap: "0 18px",
            }}
          >
            <span>Pass the CEH</span>
            <span>
              without the{" "}
              <span style={{ color: "#bef264", fontStyle: "italic" }}>
                course-ware
              </span>{" "}
              slog.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #1d1d22",
            paddingTop: 24,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            color: "#a1a1aa",
            letterSpacing: 0.4,
          }}
        >
          <div>
            14 DAYS &middot; BROWSER LAB &middot; 125-QUESTION SIMULATOR
          </div>
          <div style={{ color: "#bef264" }}>
            cehprep&middot;dev
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
