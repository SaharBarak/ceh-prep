import { ImageResponse } from "next/og";
import { getDay } from "@/lib/content";

/**
 * Per-day OG card.
 *
 * Renders the day number + module title + short blurb so shares of
 * /course/3 etc. look like real course content cards rather than the
 * default homepage card. Falls back to a generic "Day N — CEH Prep"
 * card if the day lookup misses (defensive — Next has already 404'd
 * the page by the time anyone'd see this, but this OG file is still
 * generated and we don't want a crash).
 */

export const alt = "CEH Prep — day-by-day curriculum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function DayOG({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayParam } = await params;
  const n = Number.parseInt(dayParam, 10);
  const day = Number.isFinite(n) ? getDay(n) : undefined;

  const dayNumber = day?.n ?? n;
  const title = day?.title ?? "CEH v13 module";
  const blurb = day?.blurb ?? "Pass the CEH in 14 focused days.";

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
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
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 18,
              letterSpacing: 2,
              color: "#bef264",
              textTransform: "uppercase",
            }}
          >
            Day {String(dayNumber).padStart(2, "0")} / 14
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#52525b",
            }}
          >
            Module
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#f4f4f5",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.45,
              color: "#a1a1aa",
              maxWidth: 920,
            }}
          >
            {blurb}
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
          <div>LESSON &middot; QUIZ &middot; LAB DRILL</div>
          <div style={{ color: "#bef264" }}>cehprep&middot;dev</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
