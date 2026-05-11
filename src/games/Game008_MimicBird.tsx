import { useEffect, useRef, useState } from "react";

// Mimic Bird: alternates mimicry (repeat the bird) and detection (find swapped note).

const NOTES = ["C", "D", "E", "F", "G", "A", "B", "C2"];
const HZ: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88, C2: 523.25,
};

type Phase = "intro" | "listen" | "mimic" | "swapListen" | "spot" | "result";

export default function Game008_MimicBird() {
  const acRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [userPhrase, setUserPhrase] = useState<string[]>([]);
  const [swappedPhrase, setSwappedPhrase] = useState<string[]>([]);
  const [swappedIdx, setSwappedIdx] = useState(-1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState("");

  const ac = () => {
    if (!acRef.current) {
      acRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return acRef.current;
  };

  const tone = (n: string, when = 0, dur = 0.35) => {
    const a = ac();
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(HZ[n], t);
    o.connect(g);
    g.connect(a.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const playSeq = (seq: string[]) => {
    for (let i = 0; i < seq.length; i++) tone(seq[i], i * 0.45);
  };

  const clearTimeouts = () => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
  };
  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((x) => x !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
  };

  useEffect(() => () => clearTimeouts(), []);

  const startRound = () => {
    clearTimeouts();
    const p = Array.from({ length: 4 }, () => NOTES[Math.floor(Math.random() * NOTES.length)]);
    setPhrase(p);
    setUserPhrase([]);
    setSwappedIdx(-1);
    setMsg("");
    setPhase("listen");
    schedule(() => playSeq(p), 200);
    schedule(() => setPhase("mimic"), 200 + p.length * 450 + 100);
  };

  useEffect(() => {
    if (phase === "intro") setRound(0);
  }, [phase]);

  const handleMimic = (n: string) => {
    if (phase !== "mimic") return;
    // Guard against rapid double-clicks that would exceed phrase length.
    if (userPhrase.length >= phrase.length) return;
    tone(n);
    const next = [...userPhrase, n];
    setUserPhrase(next);
    if (next.length === phrase.length) {
      const matches = next.filter((x, i) => x === phrase[i]).length;
      setScore((s) => s + matches);
      // build swapped: take user's phrase and change one note
      const idx = Math.floor(Math.random() * next.length);
      let alt = NOTES[Math.floor(Math.random() * NOTES.length)];
      while (alt === next[idx]) alt = NOTES[Math.floor(Math.random() * NOTES.length)];
      const swapped = next.slice();
      swapped[idx] = alt;
      setSwappedPhrase(swapped);
      setSwappedIdx(idx);
      setMsg(`You matched ${matches}/4 of the bird's phrase.`);
      setPhase("swapListen");
      schedule(() => playSeq(swapped), 600);
      schedule(() => setPhase("spot"), 600 + swapped.length * 450 + 100);
    }
  };

  const spot = (i: number) => {
    if (phase !== "spot") return;
    const ok = i === swappedIdx;
    setMsg(
      `Bird sang back your phrase with note ${swappedIdx + 1} changed. ${ok ? "Spotted!" : "Missed."}`,
    );
    if (ok) setScore((s) => s + 2);
    setRound((r) => r + 1);
    setPhase("result");
  };

  return (
    <div style={{ color: "#eed", fontFamily: "system-ui", padding: 12, background: "#1c2a1c" }}>
      <h2 style={{ margin: "4px 0" }}>Mimic Bird</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Listen, then click the keys to repeat the phrase. Then spot the changed note in the bird's reply.
      </div>
      <div style={{ marginTop: 10 }}>
        Round: {round} | Score: <b>{score}</b>
      </div>
      <div style={{ marginTop: 8 }}>
        {phase === "intro" && (
          <button type="button" onClick={startRound}>
            Listen to the bird
          </button>
        )}
        {phase === "listen" && <div>♪ Listening...</div>}
        {phase === "mimic" && (
          <div>
            <div style={{ marginBottom: 6 }}>Repeat the phrase ({userPhrase.length}/4):</div>
            <Keyboard onPress={handleMimic} />
          </div>
        )}
        {phase === "swapListen" && <div>♪ Bird repeats your phrase...</div>}
        {phase === "spot" && (
          <div>
            <div style={{ marginBottom: 6 }}>Which note did the bird change?</div>
            <div style={{ display: "flex", gap: 6 }}>
              {swappedPhrase.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => spot(i)}
                  style={{ padding: "10px 16px", fontSize: 16 }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => playSeq(swappedPhrase)} style={{ marginTop: 6 }}>
              Replay bird
            </button>{" "}
            <button type="button" onClick={() => playSeq(userPhrase)}>
              Replay yours
            </button>
          </div>
        )}
        {phase === "result" && (
          <div>
            <div style={{ marginBottom: 6 }}>{msg}</div>
            <button type="button" onClick={startRound}>
              Next round
            </button>
          </div>
        )}
        <div style={{ marginTop: 8, opacity: 0.85 }}>{msg && phase !== "result" ? msg : ""}</div>
      </div>
    </div>
  );
}

function Keyboard({ onPress }: { onPress: (n: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {NOTES.map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onPress(n)}
          style={{
            width: 56,
            height: 120,
            background: "#fafafa",
            color: "#222",
            fontWeight: 600,
            border: "1px solid #333",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
