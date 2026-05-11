import { useEffect, useState } from "react";

// Game 65 - Fortune Cookie
// Write short fortunes. Draw a stored fortune and rate it. Persistent (localStorage).

type Fortune = { id: string; text: string; ratings: number[]; born: number };

const KEY = "game065-fortunes";
const RATED_KEY = "game065-rated";

const SEEDED: string[] = [
  "Today, the small detour is the journey.",
  "A door you forgot exists will open.",
  "Say less, mean more.",
  "An old worry is quieter today than yesterday.",
  "The thing you postponed wants only ten minutes.",
  "Someone is grateful for a thing you don't remember doing.",
  "Trust the recipe; the kitchen is fine.",
  "A small kindness is the right size.",
  "The cookie crumbles; eat it anyway.",
  "Listen to the second answer.",
];

function loadFortunes(): Fortune[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seeded = SEEDED.map((t, i) => ({ id: `seed-${i}`, text: t, ratings: [], born: Date.now() - 86400000 }));
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function loadRated(): Set<string> {
  try {
    const raw = localStorage.getItem(RATED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export default function Game065_FortuneCookie() {
  const [fortunes, setFortunes] = useState<Fortune[]>(loadFortunes);
  const [rated, setRated] = useState<Set<string>>(loadRated);
  const [draft, setDraft] = useState("");
  const [current, setCurrent] = useState<Fortune | null>(null);
  const [mode, setMode] = useState<"write" | "draw">("draw");

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(fortunes));
  }, [fortunes]);
  useEffect(() => {
    localStorage.setItem(RATED_KEY, JSON.stringify(Array.from(rated)));
  }, [rated]);

  function drawOne() {
    const candidates = fortunes.filter((f) => !rated.has(f.id));
    const pool = candidates.length > 0 ? candidates : fortunes;
    if (pool.length === 0) return;
    setCurrent(pool[Math.floor(Math.random() * pool.length)]);
  }

  function rate(stars: number) {
    if (!current) return;
    setFortunes((fs) => fs.map((f) => (f.id === current.id ? { ...f, ratings: [...f.ratings, stars] } : f)));
    setRated((r) => new Set(r).add(current.id));
    setCurrent(null);
  }

  function submitDraft() {
    const t = draft.trim();
    if (t.length < 6) return;
    const f: Fortune = { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: t, ratings: [], born: Date.now() };
    setFortunes((fs) => [...fs, f]);
    setDraft("");
  }

  const myFortunes = fortunes.filter((f) => f.id.startsWith("u-"));
  const myScore = myFortunes.reduce((acc, f) => acc + f.ratings.reduce((a, b) => a + b, 0), 0);

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Fortune Cookie</h2>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        Write short fortunes; draw and rate others' fortunes. Your score = stars your fortunes have collected over time.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={() => setMode("draw")} style={{ background: mode === "draw" ? "#345" : "#223" }}>Draw</button>
        <button onClick={() => setMode("write")} style={{ background: mode === "write" ? "#345" : "#223" }}>Write</button>
        <span style={{ marginLeft: "auto" }}>Your earned stars: {myScore} | Fortunes in jar: {fortunes.length}</span>
      </div>
      {mode === "draw" ? (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8, minHeight: 160 }}>
          {!current ? (
            <button onClick={drawOne} style={{ padding: "10px 18px", fontSize: 16 }}>Crack a cookie</button>
          ) : (
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 20, padding: 20, background: "#fff5d2", color: "#2a230d", borderRadius: 4, marginBottom: 14 }}>
                "{current.text}"
              </div>
              <div style={{ marginBottom: 6 }}>How true does it feel today?</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rate(n)} style={{ fontSize: 18, padding: "4px 12px" }}>{"★".repeat(n)}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8 }}>
          <div style={{ marginBottom: 6 }}>Write a short fortune (under ~100 chars):</div>
          <textarea
            value={draft}
            maxLength={140}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 8, background: "#0d1320", color: "#eee", border: "1px solid #345", borderRadius: 4 }}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={submitDraft} disabled={draft.trim().length < 6}>Add to the jar</button>
            <span style={{ opacity: 0.6 }}>{draft.length}/140</span>
          </div>
        </div>
      )}
      {myFortunes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Your fortunes</div>
          {myFortunes.map((f) => {
            const avg = f.ratings.length ? (f.ratings.reduce((a, b) => a + b, 0) / f.ratings.length).toFixed(1) : "—";
            return (
              <div key={f.id} style={{ padding: 6, borderBottom: "1px solid #223" }}>
                <span style={{ fontStyle: "italic" }}>"{f.text}"</span> — {f.ratings.length} ratings, avg {avg}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
