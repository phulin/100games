import { useMemo, useState } from "react";

// The Cartographer's Doubt: read conflicting reports, annotate map with what you believe.

const W = 8;
const H = 6;

function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000000) / 1000000;
  };
}

type Feature = "hill" | "ruin" | "spring" | "grove";
const FEATURE_GLYPH: Record<Feature, string> = {
  hill: "▲",
  ruin: "◧",
  spring: "~",
  grove: "♣",
};
const FEATURE_NAMES: Feature[] = ["hill", "ruin", "spring", "grove"];

export default function Game006_TheCartographersDoubt() {
  const rng = useMemo(() => seeded(dayKey() + "cart"), []);
  const truth = useMemo(() => {
    const m: Record<string, Feature> = {};
    const count = 5;
    let placed = 0;
    while (placed < count) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * H);
      const k = `${x},${y}`;
      if (!m[k]) {
        m[k] = FEATURE_NAMES[Math.floor(rng() * FEATURE_NAMES.length)];
        placed++;
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate 6 reports — most true, some contradictory/wrong.
  const reports = useMemo(() => {
    const r = seeded(dayKey() + "reports");
    const entries = Object.entries(truth);
    const reps: { text: string; truthful: boolean }[] = [];
    // truthful clues
    for (const [k, f] of entries) {
      const [x, y] = k.split(",").map(Number);
      // describe relatively
      const others = entries.filter(([k2]) => k2 !== k);
      if (others.length) {
        const [ok, of_] = others[Math.floor(r() * others.length)];
        const [ox, oy] = ok.split(",").map(Number);
        const dx = x - ox;
        const dy = y - oy;
        const ew = dx > 0 ? "east" : dx < 0 ? "west" : "";
        const ns = dy > 0 ? "south" : dy < 0 ? "north" : "";
        const dir = [ns, ew].filter(Boolean).join("-") || "near";
        const dist = Math.abs(dx) + Math.abs(dy);
        reps.push({
          text: `"${dist} ${dist === 1 ? "league" : "leagues"} ${dir} of the ${of_}, a ${f}."`,
          truthful: true,
        });
      }
    }
    // 2 wrong / contradictory
    for (let i = 0; i < 2; i++) {
      const f = FEATURE_NAMES[Math.floor(r() * 4)];
      const f2 = FEATURE_NAMES[Math.floor(r() * 4)];
      const d = Math.floor(r() * 4) + 1;
      reps.push({
        text: `"${d} leagues from the ${f2}, you will find a ${f}." (rumor)`,
        truthful: false,
      });
    }
    // shuffle
    for (let i = reps.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [reps[i], reps[j]] = [reps[j], reps[i]];
    }
    return reps;
  }, [truth]);

  const [annotations, setAnnotations] = useState<Record<string, Feature | null>>({});
  const [tool, setTool] = useState<Feature>("hill");
  const [revealed, setRevealed] = useState(false);

  const setCell = (x: number, y: number) => {
    if (revealed) return;
    const k = `${x},${y}`;
    setAnnotations((a) => {
      const cur = a[k];
      const next = { ...a };
      if (cur === tool) delete next[k];
      else next[k] = tool;
      return next;
    });
  };

  const correct = Object.keys(truth).filter((k) => annotations[k] === truth[k]).length;
  const total = Object.keys(truth).length;

  return (
    <div style={{ color: "#221", fontFamily: "Georgia, serif", padding: 12, background: "#f3e8c8" }}>
      <h2 style={{ margin: "4px 0" }}>The Cartographer's Doubt</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
        Read the reports, deduce the map. Click cells to place features. Daily seed.
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            Tool:{" "}
            {FEATURE_NAMES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTool(f)}
                style={{
                  margin: "0 2px",
                  background: tool === f ? "#a87" : "#dcb",
                  border: "1px solid #543",
                  padding: "4px 8px",
                  fontFamily: "inherit",
                }}
              >
                {FEATURE_GLYPH[f]} {f}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${W}, 50px)`,
              gap: 1,
              background: "#765",
              padding: 1,
            }}
          >
            {Array.from({ length: W * H }, (_, i) => {
              const x = i % W;
              const y = Math.floor(i / W);
              const k = `${x},${y}`;
              const a = annotations[k];
              const t = truth[k];
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setCell(x, y)}
                  style={{
                    width: 50,
                    height: 50,
                    background: revealed && t ? "#cfa" : "#ecd",
                    border: "1px solid #ba9",
                    fontFamily: "serif",
                    fontSize: 22,
                    color: revealed && t && a === t ? "#070" : "#221",
                    position: "relative",
                  }}
                >
                  {a ? FEATURE_GLYPH[a] : ""}
                  {revealed && t && (
                    <span
                      style={{
                        position: "absolute",
                        right: 2,
                        bottom: -2,
                        fontSize: 10,
                        opacity: 0.7,
                      }}
                    >
                      {FEATURE_GLYPH[t]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setRevealed(true)} disabled={revealed}>
              Submit annotations
            </button>
            {revealed && (
              <span style={{ marginLeft: 8 }}>
                {correct}/{total} features correctly placed.
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6 }}>
          <h3 style={{ marginTop: 0 }}>Explorer reports</h3>
          {reports.map((r, i) => (
            <div key={i} style={{ marginBottom: 6, opacity: r.truthful || !revealed ? 1 : 0.5 }}>
              • {r.text}
              {revealed && !r.truthful && <span style={{ color: "#a33" }}> (false)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
