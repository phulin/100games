import { useEffect, useState } from "react";

// Game 65 - Fortune Cookie
// Write short fortunes for strangers; draw random fortunes from a global pool
// and rate them. Backed by Cloudflare D1 via /api/fortune-cookie/fortunes.
// Falls back to localStorage when the network is unavailable.

type RemoteFortune = {
  id: number;
  text: string;
  author: string | null;
  rating_sum: number;
  rating_count: number;
  created_at: number;
};

type LocalFortune = { id: string; text: string; ratings: number[]; born: number };

const API = "/api/fortune-cookie/fortunes";
const KEY = "game065-fortunes";
const RATED_KEY = "game065-rated";
const AUTHOR_KEY = "game065-author";
const MINE_KEY = "game065-mine"; // list of remote ids the user authored

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

function getAuthor(): string {
  try {
    const existing = localStorage.getItem(AUTHOR_KEY);
    if (existing) return existing;
  } catch {}
  const id =
    "a-" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6);
  try {
    localStorage.setItem(AUTHOR_KEY, id);
  } catch {}
  return id;
}

function loadLocalFortunes(): LocalFortune[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seeded = SEEDED.map((t, i) => ({
    id: `seed-${i}`,
    text: t,
    ratings: [] as number[],
    born: Date.now() - 86400000,
  }));
  try {
    localStorage.setItem(KEY, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

function loadRated(): Set<string> {
  try {
    const raw = localStorage.getItem(RATED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function loadMine(): RemoteFortune[] {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

type ViewFortune = {
  source: "remote" | "local";
  id: string; // stringified for dedupe key
  remoteId?: number;
  text: string;
};

export default function Game065_FortuneCookie() {
  const [author] = useState<string>(getAuthor);
  const [localFortunes, setLocalFortunes] = useState<LocalFortune[]>(loadLocalFortunes);
  const [rated, setRated] = useState<Set<string>>(loadRated);
  const [mine, setMine] = useState<RemoteFortune[]>(loadMine);
  const [draft, setDraft] = useState("");
  const [current, setCurrent] = useState<ViewFortune | null>(null);
  const [mode, setMode] = useState<"write" | "draw">("draw");
  const [status, setStatus] = useState<string>("");
  const [online, setOnline] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(localFortunes));
    } catch {}
  }, [localFortunes]);
  useEffect(() => {
    try {
      localStorage.setItem(RATED_KEY, JSON.stringify(Array.from(rated)));
    } catch {}
  }, [rated]);
  useEffect(() => {
    try {
      localStorage.setItem(MINE_KEY, JSON.stringify(mine));
    } catch {}
  }, [mine]);

  function drawLocal() {
    const candidates = localFortunes.filter((f) => !rated.has(`local:${f.id}`));
    const pool = candidates.length > 0 ? candidates : localFortunes;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setCurrent({ source: "local", id: `local:${pick.id}`, text: pick.text });
  }

  async function drawOne() {
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch(`${API}?exclude=${encodeURIComponent(author)}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { fortune: RemoteFortune | null };
      setOnline(true);
      if (data.fortune) {
        setCurrent({
          source: "remote",
          id: `remote:${data.fortune.id}`,
          remoteId: data.fortune.id,
          text: data.fortune.text,
        });
      } else {
        // Pool empty — fall back to local seed.
        drawLocal();
      }
    } catch {
      setOnline(false);
      setStatus("Offline — drawing from local jar.");
      drawLocal();
    } finally {
      setBusy(false);
    }
  }

  async function rate(stars: number) {
    if (!current) return;
    const target = current;
    setRated((r) => new Set(r).add(target.id));
    setCurrent(null);

    if (target.source === "local") {
      setLocalFortunes((fs) =>
        fs.map((f) =>
          `local:${f.id}` === target.id ? { ...f, ratings: [...f.ratings, stars] } : f,
        ),
      );
      return;
    }

    if (target.remoteId == null) return;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "rate",
          fortune_id: target.remoteId,
          author,
          stars,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        fortune_id: number;
        rating_sum: number;
        rating_count: number;
      };
      setOnline(true);
      // Update mine list if it's one of mine.
      setMine((m) =>
        m.map((f) =>
          f.id === data.fortune_id
            ? { ...f, rating_sum: data.rating_sum, rating_count: data.rating_count }
            : f,
        ),
      );
    } catch {
      setOnline(false);
      setStatus("Rating saved locally (offline).");
    }
  }

  async function submitDraft() {
    const t = draft.trim();
    if (t.length < 6) return;
    if (t.length > 200) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", text: t, author }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { fortune: RemoteFortune };
      setOnline(true);
      setMine((m) => [...m, data.fortune]);
      setDraft("");
      setStatus("Sent into the world.");
    } catch {
      setOnline(false);
      // Offline fallback — store locally.
      const f: LocalFortune = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: t,
        ratings: [],
        born: Date.now(),
      };
      setLocalFortunes((fs) => [...fs, f]);
      setDraft("");
      setStatus("Offline — saved locally.");
    } finally {
      setBusy(false);
    }
  }

  // On mount, refresh mine aggregates if online (best-effort: skip, server is source of truth)
  useEffect(() => {
    // no-op — aggregates update when user rates remote fortunes
  }, []);

  const myScore = mine.reduce((acc, f) => acc + f.rating_sum, 0);
  const myCount = mine.length;

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Fortune Cookie</h2>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        Write short fortunes for strangers; draw and rate fortunes from a global pool.
        Your score = stars your fortunes earn over time.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <button onClick={() => setMode("draw")} style={{ background: mode === "draw" ? "#345" : "#223" }}>Draw</button>
        <button onClick={() => setMode("write")} style={{ background: mode === "write" ? "#345" : "#223" }}>Write</button>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>
          Earned stars: {myScore} | Yours sent: {myCount} {online ? "" : "| offline"}
        </span>
      </div>
      {status && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{status}</div>
      )}
      {mode === "draw" ? (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8, minHeight: 160 }}>
          {!current ? (
            <button onClick={drawOne} disabled={busy} style={{ padding: "10px 18px", fontSize: 16 }}>
              {busy ? "Cracking..." : "Crack a cookie"}
            </button>
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
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
                {current.source === "remote" ? "From the global jar" : "From your local jar"}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8 }}>
          <div style={{ marginBottom: 6 }}>Write a short fortune (under 200 chars):</div>
          <textarea
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 8, background: "#0d1320", color: "#eee", border: "1px solid #345", borderRadius: 4 }}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={submitDraft} disabled={busy || draft.trim().length < 6}>
              {busy ? "Sending..." : "Send into the world"}
            </button>
            <span style={{ opacity: 0.6 }}>{draft.length}/200</span>
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Your fortunes (in the global jar)</div>
          {mine.map((f) => {
            const avg = f.rating_count
              ? (f.rating_sum / f.rating_count).toFixed(1)
              : "—";
            return (
              <div key={f.id} style={{ padding: 6, borderBottom: "1px solid #223" }}>
                <span style={{ fontStyle: "italic" }}>"{f.text}"</span> — {f.rating_count} ratings, avg {avg}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
