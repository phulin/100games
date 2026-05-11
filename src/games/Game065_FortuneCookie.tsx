import { useEffect, useState } from "react";

// Game 65 - Fortune Cookie
// Write short fortunes for strangers; draw random fortunes from a global pool
// and rate them. Backed by Cloudflare D1 via /api/fortune-cookie/fortunes.
// No hardcoded seed fortunes - when the jar is empty, the player writes the
// first one.

type RemoteFortune = {
  id: number;
  text: string;
  author: string | null;
  rating_sum: number;
  rating_count: number;
  created_at: number;
};

const API = "/api/fortune-cookie/fortunes";
const RATED_KEY = "game065-rated";
const AUTHOR_KEY = "game065-author";
const HISTORY_KEY = "game065-history";

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}
function crackSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(0.08 * ctx.sampleRate), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  noise.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.value = 0.06;
  noise.connect(ng).connect(ctx.destination);
  noise.start();
  blip(520, 0.15, "triangle", 0.05);
  setTimeout(() => blip(380, 0.12, "triangle", 0.04), 50);
}

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

function loadRated(): Set<string> {
  try {
    const raw = localStorage.getItem(RATED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function loadHistory(): { id: number; text: string; stars: number; at: number }[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

type ViewFortune = {
  id: string;
  remoteId: number;
  text: string;
};

export default function Game065_FortuneCookie() {
  const [author] = useState<string>(getAuthor);
  const [rated, setRated] = useState<Set<string>>(loadRated);
  const [mine, setMine] = useState<RemoteFortune[]>([]);
  const [top, setTop] = useState<RemoteFortune[]>([]);
  const [history, setHistory] = useState(loadHistory);
  const [draft, setDraft] = useState("");
  const [current, setCurrent] = useState<ViewFortune | null>(null);
  const [mode, setMode] = useState<"write" | "draw" | "top">("draw");
  const [status, setStatus] = useState<string>("");
  const [online, setOnline] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [stats, setStats] = useState<{ total_fortunes: number; total_ratings: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(RATED_KEY, JSON.stringify(Array.from(rated))); } catch {}
  }, [rated]);
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50))); } catch {}
  }, [history]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mineRes, statsRes, topRes] = await Promise.all([
          fetch(`${API}?mode=mine&author=${encodeURIComponent(author)}`),
          fetch(`${API}?mode=stats`),
          fetch(`${API}?mode=top&limit=5`),
        ]);
        if (cancelled) return;
        if (mineRes.ok) {
          const d = (await mineRes.json()) as { fortunes: RemoteFortune[] };
          setMine(d.fortunes ?? []);
        }
        if (statsRes.ok) {
          const d = (await statsRes.json()) as { total_fortunes: number; total_ratings: number };
          setStats(d);
        }
        if (topRes.ok) {
          const d = (await topRes.json()) as { fortunes: RemoteFortune[] };
          setTop(d.fortunes ?? []);
        }
        setOnline(true);
      } catch {
        setOnline(false);
      }
    })();
    return () => { cancelled = true; };
  }, [author]);

  async function drawOne() {
    setStatus("");
    setBusy(true);
    crackSound();
    try {
      const res = await fetch(`${API}?exclude=${encodeURIComponent(author)}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { fortune: RemoteFortune | null };
      setOnline(true);
      if (data.fortune) {
        setCurrent({
          id: `remote:${data.fortune.id}`,
          remoteId: data.fortune.id,
          text: data.fortune.text,
        });
      } else {
        setStatus("The jar is empty. Write one to start it off!");
        setCurrent(null);
      }
    } catch {
      setOnline(false);
      setStatus("Offline - try again later.");
      setCurrent(null);
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (!current) return;
    blip(280, 0.08, "square", 0.04);
    setCurrent(null);
    drawOne();
  }

  async function rate(stars: number) {
    if (!current) return;
    const target = current;
    setRated((r) => new Set(r).add(target.id));
    blip(660 + stars * 80, 0.12, "triangle", 0.06);
    setTimeout(() => blip(880 + stars * 80, 0.1, "triangle", 0.05), 60);
    setHistory((h) => [...h, { id: target.remoteId, text: target.text, stars, at: Date.now() }]);
    setCurrent(null);

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
    if (t.length < 6) {
      setStatus("Too short - at least 6 characters.");
      return;
    }
    if (t.length > 200) {
      setStatus("Too long - 200 characters max.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", text: t, author }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          setStatus("You've already sent this one.");
          setBusy(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { fortune: RemoteFortune };
      setOnline(true);
      setMine((m) => [data.fortune, ...m]);
      setDraft("");
      setStatus("Sent into the world.");
      blip(660, 0.15, "sine", 0.06);
      setTimeout(() => blip(990, 0.18, "sine", 0.06), 130);
    } catch {
      setOnline(false);
      setStatus("Offline - try again when connected.");
    } finally {
      setBusy(false);
    }
  }

  const myScore = mine.reduce((acc, f) => acc + f.rating_sum, 0);
  const ratedMine = mine.filter((f) => f.rating_count > 0);
  const myAvg = ratedMine.length
    ? (ratedMine.reduce((acc, f) => acc + f.rating_sum / f.rating_count, 0) / ratedMine.length).toFixed(2)
    : "-";
  const draftLen = draft.length;
  const draftColor = draftLen > 180 ? "#e85d5d" : draftLen > 150 ? "#f0a040" : draftLen >= 6 ? "#7df1c5" : "#aaa";

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Fortune Cookie</h2>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        Write short fortunes for strangers; draw and rate fortunes from a global pool.
        Your score = stars your fortunes earn over time.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setMode("draw")} style={{ background: mode === "draw" ? "#345" : "#223" }}>Draw</button>
        <button onClick={() => setMode("write")} style={{ background: mode === "write" ? "#345" : "#223" }}>Write</button>
        <button onClick={() => setMode("top")} style={{ background: mode === "top" ? "#345" : "#223" }}>Top</button>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          Earned stars: {myScore} | Yours: {mine.length} (avg {myAvg}) {online ? "" : "| offline"}
        </span>
      </div>
      {stats && (
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
          Global jar: {stats.total_fortunes} fortunes - {stats.total_ratings} ratings
        </div>
      )}
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rate(n)} style={{ fontSize: 18, padding: "4px 12px" }}>{"*".repeat(n)}</button>
                ))}
                <button onClick={skip} style={{ marginLeft: "auto", fontSize: 13 }}>skip</button>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
                From the global jar
              </div>
            </div>
          )}
          {history.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7 }}>
              <div>Recently rated:</div>
              {history.slice(-3).reverse().map((h, i) => (
                <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid #223" }}>
                  {"*".repeat(h.stars)} "{h.text.length > 60 ? h.text.slice(0, 60) + "..." : h.text}"
                </div>
              ))}
            </div>
          )}
        </div>
      ) : mode === "write" ? (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8 }}>
          <div style={{ marginBottom: 6 }}>Write a short fortune (6-200 chars):</div>
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
            <span style={{ color: draftColor }}>{draftLen}/200</span>
          </div>
        </div>
      ) : (
        <div style={{ background: "#1f2c3a", padding: 14, borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontSize: 13 }}>Top-rated fortunes in the jar</div>
          {top.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 12 }}>Nothing has been rated yet.</div>
          ) : (
            top.map((f) => {
              const avg = f.rating_count ? (f.rating_sum / f.rating_count).toFixed(2) : "-";
              return (
                <div key={f.id} style={{ padding: 6, borderBottom: "1px solid #223" }}>
                  <span style={{ fontStyle: "italic" }}>"{f.text}"</span>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{f.rating_count} ratings - avg {avg}</div>
                </div>
              );
            })
          )}
        </div>
      )}
      {mine.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Your fortunes (in the global jar)</div>
          {mine.map((f) => {
            const avg = f.rating_count
              ? (f.rating_sum / f.rating_count).toFixed(1)
              : "-";
            return (
              <div key={f.id} style={{ padding: 6, borderBottom: "1px solid #223" }}>
                <span style={{ fontStyle: "italic" }}>"{f.text}"</span> - {f.rating_count} ratings, avg {avg}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
