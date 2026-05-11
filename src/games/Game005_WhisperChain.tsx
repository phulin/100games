import { useEffect, useRef, useState } from "react";

// Whisper Chain: see a sentence for 5 seconds, then type what you remember.
// Backed by Cloudflare D1 via /api/whisper-chain/chain.
// Falls back to localStorage if the API is unreachable.

const KEY = "whisper-chain-v1";
const AUTHOR_KEY = "whisper-chain-author";
const API = "/api/whisper-chain/chain";
const MAX_LEN = 280;

const SEED_CHAIN = [
  "The lighthouse keeper traded a candle for a song.",
  "A red kite climbed past the cathedral spire.",
  "Honeybees argued the value of clover in the rain.",
  "Three pebbles spelled a name no one could read.",
];

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
  return SEED_CHAIN.map((s) => ({ text: s }));
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

export default function Game005_WhisperChain() {
  const [chain, setChain] = useState<ChainLink[]>(loadLocal);
  const [phase, setPhase] = useState<"show" | "type" | "done">("show");
  const [timeLeft, setTimeLeft] = useState(5);
  const [input, setInput] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const authorRef = useRef<string>(getAuthorId());

  const current = chain[chain.length - 1]?.text ?? "";

  // Fetch latest chain on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { chain?: ChainLink[] };
        if (cancelled) return;
        if (Array.isArray(data.chain) && data.chain.length > 0) {
          setChain(data.chain);
          saveLocal(data.chain);
          setOnline(true);
        } else if (Array.isArray(data.chain)) {
          // Empty server -> stay local but mark online.
          setOnline(true);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
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
  }, [phase]);

  const submit = async () => {
    const v = input.trim().slice(0, MAX_LEN);
    if (!v || submitting) return;
    setSubmitting(true);
    setError(null);

    let appended: ChainLink = { text: v, author: authorRef.current };
    let success = false;
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
        success = true;
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
      }
    } catch {
      setOnline(false);
    }

    // Append locally either way so the game progresses offline too.
    const c = [...chain, appended];
    setChain(c);
    saveLocal(c);
    setPhase("done");
    setSubmitting(false);
    if (!success && !error) {
      // Silent offline append is fine.
    }
  };

  const restart = () => {
    setPhase("show");
    setTimeLeft(5);
    setInput("");
    setError(null);
  };

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
      </div>
      {phase === "show" && (
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
        </div>
      )}
      {phase === "type" && (
        <div>
          <div style={{ marginBottom: 6, fontSize: 14 }}>Type what you remember:</div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
            rows={3}
            maxLength={MAX_LEN}
            style={{ width: "100%", padding: 10, fontSize: 18, fontFamily: "inherit" }}
          />
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {input.length}/{MAX_LEN}
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
          </div>
          <button type="button" onClick={restart}>
            Pull another whisper
          </button>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Chain ({chain.length})</h3>
        <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.6, maxHeight: 240, overflow: "auto" }}>
          {chain.map((link, i) => (
            <li
              key={link.id ?? `${i}-${link.text.slice(0, 8)}`}
              style={{ opacity: i === chain.length - 1 ? 1 : 0.7 }}
            >
              {link.text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
