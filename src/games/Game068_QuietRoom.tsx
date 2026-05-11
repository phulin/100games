import { useEffect, useMemo, useRef, useState } from "react";

// Game 68 - Quiet Room
// A grid where each cell can hold a sound-emitting object. Each object pans
// L/R by its X position and gain by Y. Reconstruct a target soundscape by ear.

type Obj = { kind: number; x: number; y: number };

const GRID = 8;
const KINDS = [
  { name: "wind", freq: 220, type: "noise" },
  { name: "bell", freq: 880, type: "tone" },
  { name: "drip", freq: 1200, type: "blip" },
  { name: "hum", freq: 110, type: "tone" },
];

function randomTarget(seed: number): Obj[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: Obj[] = [];
  const count = 3;
  const usedKinds = new Set<number>();
  while (out.length < count) {
    const k = Math.floor(rand() * KINDS.length);
    if (usedKinds.has(k)) continue;
    usedKinds.add(k);
    out.push({ kind: k, x: Math.floor(rand() * GRID), y: Math.floor(rand() * GRID) });
  }
  return out;
}

export default function Game068_QuietRoom() {
  const [seed, setSeed] = useState(11);
  const target = useMemo(() => randomTarget(seed), [seed]);
  const [placed, setPlaced] = useState<Obj[]>([]);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState<"target" | "yours" | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<() => void>(() => {});

  function ensureCtx() {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioRef.current;
  }

  function play(objs: Obj[]) {
    stopRef.current();
    const ctx = ensureCtx();
    const nodes: { stop: () => void }[] = [];
    for (const o of objs) {
      const k = KINDS[o.kind];
      const pan = (o.x / (GRID - 1)) * 2 - 1;
      const gain = 0.1 + (1 - o.y / (GRID - 1)) * 0.3;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      const g = ctx.createGain();
      g.gain.value = gain;
      panner.connect(g).connect(ctx.destination);
      if (k.type === "tone") {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = k.freq;
        osc.connect(panner);
        osc.start();
        nodes.push({ stop: () => osc.stop() });
      } else if (k.type === "noise") {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(panner);
        src.start();
        nodes.push({ stop: () => src.stop() });
      } else {
        // blip — schedule repeating blips
        let alive = true;
        const tick = () => {
          if (!alive) return;
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.frequency.value = k.freq;
          env.gain.setValueAtTime(0, ctx.currentTime);
          env.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.005);
          env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.connect(env).connect(panner);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
          setTimeout(tick, 600 + Math.random() * 400);
        };
        tick();
        nodes.push({ stop: () => (alive = false) });
      }
    }
    stopRef.current = () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {}
      }
    };
  }

  function playTarget() {
    setPlaying("target");
    play(target);
    setTimeout(() => {
      stopRef.current();
      setPlaying(null);
    }, 3000);
  }

  function playYours() {
    setPlaying("yours");
    play(placed);
    setTimeout(() => {
      stopRef.current();
      setPlaying(null);
    }, 3000);
  }

  function clickCell(x: number, y: number) {
    setPlaced((p) => {
      const existing = p.findIndex((o) => o.kind === selected);
      if (existing >= 0) {
        const cp = p.slice();
        cp[existing] = { kind: selected, x, y };
        return cp;
      }
      return [...p, { kind: selected, x, y }];
    });
  }

  function score() {
    // For each target obj, find placed obj of same kind, measure distance
    let total = 0;
    let missing = 0;
    for (const t of target) {
      const m = placed.find((p) => p.kind === t.kind);
      if (!m) {
        missing++;
        continue;
      }
      total += Math.hypot(t.x - m.x, t.y - m.y);
    }
    return { error: total.toFixed(1), missing };
  }

  const s = score();

  useEffect(() => () => stopRef.current(), []);

  function newPuzzle() {
    stopRef.current();
    setSeed((s) => s + 1);
    setPlaced([]);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Quiet Room</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Play the target. Each sound corresponds to one hidden grid cell — its X-position pans the audio L/R; Y controls volume. Place objects on the grid to match by ear.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
        <button onClick={playTarget} disabled={playing !== null}>▶ Target</button>
        <button onClick={playYours} disabled={playing !== null}>▶ Yours</button>
        <button onClick={newPuzzle}>New Puzzle</button>
        <span style={{ marginLeft: "auto" }}>Distance error: {s.error} | Missing: {s.missing}/{target.length}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {KINDS.map((k, i) => (
          <button key={i} onClick={() => setSelected(i)} style={{ background: selected === i ? "#345" : "#223" }}>
            {k.name}
          </button>
        ))}
      </div>
      <svg width={GRID * 50} height={GRID * 50} style={{ background: "#0d1320", borderRadius: 6 }}>
        {Array.from({ length: GRID }).map((_, y) =>
          Array.from({ length: GRID }).map((_, x) => (
            <rect
              key={`${x}-${y}`}
              x={x * 50}
              y={y * 50}
              width={49}
              height={49}
              fill="#1f2c3a"
              stroke="#0d1320"
              onClick={() => clickCell(x, y)}
              style={{ cursor: "pointer" }}
            />
          ))
        )}
        {placed.map((o, i) => (
          <g key={i} pointerEvents="none">
            <circle cx={o.x * 50 + 25} cy={o.y * 50 + 25} r={16} fill={["#f4c542", "#7df1c5", "#5b8def", "#ff7d8f"][o.kind]} />
            <text x={o.x * 50 + 25} y={o.y * 50 + 30} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000">
              {KINDS[o.kind].name}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>X = pan (left→right), Y = louder→quieter</div>
    </div>
  );
}
