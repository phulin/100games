import { useEffect, useMemo, useRef, useState } from "react";

// Whisper Chain: see a sentence for a few seconds, then type what you remember.
// Backed by Cloudflare D1 via /api/whisper-chain/chain.
// No hardcoded seed sentences: empty state is shown honestly if the chain is empty.

const KEY = "whisper-chain-v1";
const AUTHOR_KEY = "whisper-chain-author";
const API = "/api/whisper-chain/chain";
const MAX_LEN = 280;

type ChainLink = {
  id?: number;
  text: string;
  author?: string | null;
  created_at?: number;
};

function loadLocal(): ChainLink[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) =>
          typeof p === "string" ? { text: p } : (p as ChainLink),
        );
      }
    }
  } catch {}
  return [];
}

function saveLocal(c: ChainLink[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

function getAuthorId(): string {
  try {
    let id = localStorage.getItem(AUTHOR_KEY);
    if (id && /^[a-zA-Z0-9_-]+$/.test(id)) return id;
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(AUTHOR_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a).split(" ").filter(Boolean));
  const wb = new Set(normalize(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return inter / union;
}

function identicon(id: string): { fg: string; bg: string; pattern: boolean[] } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const fg = `hsl(${h % 360}, 60%, 55%)`;
  const bg = `hsl(${(h >>> 8) % 360}, 30%, 22%)`;
  const pattern: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    pattern.push((h & 1) === 1);
  }
  return { fg, bg, pattern };
}

function Identicon({ id, size = 24 }: { id: string; size?: number }) {
  const { fg, bg, pattern } = useMemo(() => identicon(id), [id]);
  const cell = size / 5;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 5; y++) {
    for (let xi = 0; xi < 3; xi++) {
      if (pattern[y * 3 + xi]) {
        const xs = [xi, 4 - xi];
        for (const x of xs) {
          rects.push(
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill={fg}
            />,
          );
        }
      }
    }
  }
  return (
    <svg width={size} height={size} style={{ background: bg, borderRadius: 4, flexShrink: 0 }}>
      <title>identicon</title>
      {rects}
    </svg>
  );
}

export default function Game005_WhisperChain() {
  const [chain, setChain] = useState<ChainLink[]>(loadLocal);
  const [phase, setPhase] = useState<"show" | "type" | "done">("show");
  const [showSeconds, setShowSeconds] = useState(5);
  const [timeLeft, setTimeLeft] = useState(5);
  const [input, setInput] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const authorRef = useRef<string>(getAuthorId());

  const current = chain[chain.length - 1]?.text ?? "";
  const isEmpty = chain.length === 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { chain?: ChainLink[] };
        if (cancelled) return;
        if (Array.isArray(data.chain)) {
          setChain(data.chain);
          saveLocal(data.chain);
          setOnline(true);
        }
      } catch {
        if (!cancelled) setOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && isEmpty && phase === "show") {
      setPhase("type");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, isEmpty, phase]);

  useEffect(() => {
    if (phase !== "show" || isEmpty) return;
    setTimeLeft(showSeconds);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("type");
          setTimeout(() => inputRef.current?.focus(), 50);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isEmpty, showSeconds]);

  const submit = async () => {
    const v = input.trim().slice(0, MAX_LEN);
    if (!v || submitting) return;
    setSubmitting(true);
    setError(null);

    let appended: ChainLink = { text: v, author: authorRef.current };
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v, author: authorRef.current }),
      });
      if (res.ok) {
        const data = (await res.json()) as { link?: ChainLink };
        if (data.link) appended = data.link;
        setOnline(true);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
      }
    } catch {
      setOnline(false);
    }

    const c = [...chain, appended];
    setChain(c);
    saveLocal(c);
    if (current) {
      const s = similarity(current, v);
      setLastScore(Math.round(s * 100));
    } else {
      setLastScore(null);
    }
    setPhase("done");
    setSubmitting(false);
  };

  const restart = () => {
    setPhase("show");
    setTimeLeft(showSeconds);
    setInput("");
    setError(null);
    setLastScore(null);
  };

  const drift = useMemo(() => {
    const points: { idx: number; words: number; sim: number }[] = [];
    for (let i = 0; i < chain.length; i++) {
      const words = normalize(chain[i].text).split(" ").filter(Boolean).length;
      const sim = i === 0 ? 1 : similarity(chain[i - 1].text, chain[i].text);
      points.push({ idx: i, words, sim });
    }
    return points;
  }, [chain]);

  return (
    <div style={{ color: "#eee", fontFamily: "Georgia, serif", padding: 12, maxWidth: 760 }}>
      <h2 style={{ margin: "4px 0" }}>Whisper Chain</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        Read the sentence, then retype it from memory. Your version joins the chain.
        {online === true && (
          <span style={{ marginLeft: 8, color: "#7fd97f" }}>(global chain)</span>
        )}
        {online === false && (
          <span style={{ marginLeft: 8, color: "#d9b07f" }}>(offline — local only)</span>
        )}
        <span style={{ marginLeft: 12 }}>
          Memorize for:{" "}
          <select
            value={showSeconds}
            onChange={(e) => setShowSeconds(Number(e.target.value))}
            disabled={phase !== "show"}
          >
            <option value={3}>3s (hard)</option>
            <option value={5}>5s (normal)</option>
            <option value={10}>10s (easy)</option>
          </select>
        </span>
      </div>
      {loading && <div style={{ opacity: 0.6 }}>Loading chain…</div>}
      {!loading && isEmpty && phase === "type" && (
        <div style={{ marginBottom: 10, fontSize: 14, opacity: 0.85 }}>
          The chain is empty. Write the first whisper to start it.
        </div>
      )}
      {phase === "show" && !isEmpty && (
        <div
          style={{
            padding: 24,
            background: "#222",
            borderRadius: 8,
            fontSize: 22,
            lineHeight: 1.4,
            textAlign: "center",
            minHeight: 100,
          }}
        >
          <div>{current}</div>
          <div style={{ marginTop: 16, fontSize: 14, opacity: 0.6 }}>{timeLeft}s</div>
          <div
            style={{
              marginTop: 8,
              height: 4,
              background: "#333",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(timeLeft / showSeconds) * 100}%`,
                background: "#7fd97f",
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
      )}
      {phase === "type" && (
        <div>
          <div style={{ marginBottom: 6, fontSize: 14 }}>
            {isEmpty ? "Write the seed whisper:" : "Type what you remember:"}
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            rows={3}
            maxLength={MAX_LEN}
            style={{ width: "100%", padding: 10, fontSize: 18, fontFamily: "inherit" }}
          />
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {input.length}/{MAX_LEN} · Ctrl+Enter to send
          </div>
          <button type="button" onClick={submit} disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? "Sending..." : "Send into the chain"}
          </button>
          {error && (
            <div style={{ color: "#f08080", marginTop: 6, fontSize: 13 }}>{error}</div>
          )}
        </div>
      )}
      {phase === "done" && (
        <div>
          <div style={{ marginBottom: 8 }}>
            Your link was added. The chain now has {chain.length} entries.
            {lastScore !== null && (
              <div style={{ marginTop: 4, fontSize: 14 }}>
                Memory fidelity (Jaccard word overlap): <b>{lastScore}%</b>
              </div>
            )}
          </div>
          <button type="button" onClick={restart}>
            Pull another whisper
          </button>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Chain ({chain.length})</h3>
        {drift.length > 1 && (
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Avg overlap with prior link:{" "}
            <b>
              {Math.round(
                (drift.slice(1).reduce((a, p) => a + p.sim, 0) / Math.max(1, drift.length - 1)) * 100,
              )}
              %
            </b>
            {" · "} avg words: <b>{Math.round(drift.reduce((a, p) => a + p.words, 0) / drift.length)}</b>
          </div>
        )}
        <ol
          style={{
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.6,
            maxHeight: 240,
            overflow: "auto",
            margin: 0,
          }}
        >
          {chain.map((link, i) => {
            const aid = link.author || "anon";
            return (
              <li
                key={link.id ?? `${i}-${link.text.slice(0, 8)}`}
                style={{
                  opacity: i === chain.length - 1 ? 1 : 0.7,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "3px 0",
                }}
              >
                <Identicon id={aid} size={20} />
                <span>{link.text}</span>
              </li>
            );
          })}
        </ol>
        {chain.length === 0 && !loading && (
          <div style={{ opacity: 0.6, fontSize: 13 }}>
            No links yet. Be the first whisper.
          </div>
        )}
      </div>
    </div>
  );
}
