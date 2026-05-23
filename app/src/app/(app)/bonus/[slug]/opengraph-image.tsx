import { ImageResponse } from "next/og";
import { getBonusItem } from "@/lib/content/bonus";

/**
 * Per-bonus-article OG card.
 *
 * Shares of /bonus/<slug> render the article title + the primary CEH-day
 * tag so the link card communicates "this is a deep-dive on Day N's
 * material" at a glance.
 */

export const alt = "CEH Prep — bonus library article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BonusOG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getBonusItem(slug);

  const title = item?.title ?? "Bonus library";
  const teaser = item?.teaser ?? "Practitioner write-ups, tool deep-dives, repo tours.";
  const dayTag = item?.primaryDay ? `DAY ${String(item.primaryDay).padStart(2, "0")} EXTRA` : "BONUS LIBRARY";

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
              fontSize: 16,
              letterSpacing: 3,
              color: "#bef264",
              textTransform: "uppercase",
              border: "1px solid #bef264",
              padding: "8px 16px",
              borderRadius: 4,
            }}
          >
            {dayTag}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
            maxWidth: 1040,
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? 56 : 72,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              color: "#f4f4f5",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 24,
              lineHeight: 1.45,
              color: "#a1a1aa",
              maxWidth: 920,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {teaser}
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
          <div>BONUS LIBRARY &middot; CURATED EXTRAS</div>
          <div style={{ color: "#bef264" }}>cehprep&middot;dev</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
