import { useEffect, useRef, useState } from "react";

// Whisper Chain: see a sentence for 5 seconds, then type what you remember.
// Persisted in localStorage as the global chain.

const KEY = "whisper-chain-v1";

const SEED_CHAIN = [
  "The lighthouse keeper traded a candle for a song.",
  "A red kite climbed past the cathedral spire.",
  "Honeybees argued the value of clover in the rain.",
  "Three pebbles spelled a name no one could read.",
];

function loadChain(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...SEED_CHAIN];
}
function saveChain(c: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

export default function Game005_WhisperChain() {
  const [chain, setChain] = useState<string[]>(loadChain);
  const [phase, setPhase] = useState<"show" | "type" | "done">("show");
  const [timeLeft, setTimeLeft] = useState(5);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const current = chain[chain.length - 1];

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

  const submit = () => {
    const v = input.trim();
    if (!v) return;
    const c = [...chain, v];
    setChain(c);
    saveChain(c);
    setPhase("done");
  };

  const restart = () => {
    setPhase("show");
    setTimeLeft(5);
    setInput("");
  };

  return (
    <div style={{ color: "#eee", fontFamily: "Georgia, serif", padding: 12, maxWidth: 760 }}>
      <h2 style={{ margin: "4px 0" }}>Whisper Chain</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        Read the sentence, then retype it from memory. Your version joins the chain.
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
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 10, fontSize: 18, fontFamily: "inherit" }}
          />
          <button type="button" onClick={submit} style={{ marginTop: 6 }}>
            Send into the chain
          </button>
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
          {chain.map((s, i) => (
            <li key={`${i}-${s.slice(0, 8)}`} style={{ opacity: i === chain.length - 1 ? 1 : 0.7 }}>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
