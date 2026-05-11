import { useEffect, useMemo, useRef, useState } from "react";

// Game 68 - Quiet Room
// A grid where each cell can hold a sound-emitting object. Each object pans
// L/R by its X position and gain by Y. Reconstruct a target soundscape by ear.

type Kind = { name: string; freq: number; type: "tone" | "noise" | "blip"; color: string };
type Obj = { kind: number; x: number; y: number };

const GRID = 8;

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_NAMES = ["wind", "bell", "drip", "hum", "purr", "click", "chirp", "creak"];
const TYPES: ("tone" | "noise" | "blip")[] = ["tone", "noise", "blip"];
const PALETTE = ["#f4c542", "#7df1c5", "#5b8def", "#ff7d8f", "#c896ff", "#ffa872", "#9fe66b", "#ff5cae"];

function genKinds(seed: number): Kind[] {
  const r = mulberry32(seed ^ 0x10aa);
  const names = KIND_NAMES.slice();
  const palette = PALETTE.slice();
  const kinds: Kind[] = [];
  for (let i = 0; i < 5; i++) {
    const name = names.splice(Math.floor(r() * names.length), 1)[0];
    const type = TYPES[Math.floor(r() * TYPES.length)];
    const freq = 90 + Math.floor(r() * 1500);
    const color = palette.splice(Math.floor(r() * palette.length), 1)[0];
    kinds.push({ name, freq, type, color });
  }
  return kinds;
}

function genTarget(seed: number, kinds: Kind[]): Obj[] {
  const r = mulberry32(seed ^ 0xface);
  const count = 3 + Math.floor(r() * 2);
  const out: Obj[] = [];
  const usedKinds = new Set<number>();
  while (out.length < count) {
    const k = Math.floor(r() * kinds.length);
    if (usedKinds.has(k)) continue;
    usedKinds.add(k);
    out.push({ kind: k, x: Math.floor(r() * GRID), y: Math.floor(r() * GRID) });
  }
  return out;
}

export default function Game068_QuietRoom() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const KINDS = useMemo(() => genKinds(seed), [seed]);
  const target = useMemo(() => genTarget(seed, KINDS), [seed, KINDS]);
  const [placed, setPlaced] = useState<Obj[]>([]);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState<"target" | "yours" | "preview" | null>(null);
  const [history, setHistory] = useState<{ seed: number; error: number; missing: number }[]>(() => {
    try {
      const v = localStorage.getItem("g68_history");
      return v ? JSON.parse(v) : [];
    } catch {
      return [];
    }
  });
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
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(ctx.destination);

    for (const o of objs) {
      const k = KINDS[o.kind];
      const pan = (o.x / (GRID - 1)) * 2 - 1;
      const gain = 0.1 + (1 - o.y / (GRID - 1)) * 0.3;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      const g = ctx.createGain();
      g.gain.value = gain;
      panner.connect(g);
      g.connect(ctx.destination);
      g.connect(delay);
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
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = k.freq;
        filter.Q.value = 1.2;
        src.connect(filter).connect(panner);
        src.start();
        nodes.push({ stop: () => src.stop() });
      } else {
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
          setTimeout(tick, 500 + Math.random() * 400);
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
      try {
        wet.disconnect();
      } catch {}
    };
  }

  function playTarget() {
    setPlaying("target");
    play(target);
    setTimeout(() => {
      stopRef.current();
      setPlaying(null);
    }, 3500);
  }

  function playYours() {
    setPlaying("yours");
    play(placed);
    setTimeout(() => {
      stopRef.current();
      setPlaying(null);
    }, 3500);
  }

  function previewCell(x: number, y: number) {
    setPlaying("preview");
    play([{ kind: selected, x, y }]);
    setTimeout(() => {
      stopRef.current();
      setPlaying(null);
    }, 700);
  }

  function clickCell(x: number, y: number, ev: React.MouseEvent) {
    if (ev.shiftKey) {
      previewCell(x, y);
      return;
    }
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
    return { error: total, missing };
  }

  const s = score();

  function submit() {
    const next = [{ seed, error: parseFloat(s.error.toFixed(2)), missing: s.missing }, ...history].slice(0, 10);
    setHistory(next);
    try {
      localStorage.setItem("g68_history", JSON.stringify(next));
    } catch {}
  }

  useEffect(() => () => stopRef.current(), []);

  function newPuzzle() {
    stopRef.current();
    setSeed(Math.floor(Math.random() * 1e9));
    setPlaced([]);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Quiet Room</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Play the target. Each sound's X-pos pans L/R, Y-pos controls volume. Shift-click a cell to preview the selected kind there.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "8px 0", flexWrap: "wrap" }}>
        <button onClick={playTarget} disabled={playing !== null}>▶ Target</button>
        <button onClick={playYours} disabled={playing !== null}>▶ Yours</button>
        <button onClick={submit}>Submit</button>
        <button onClick={newPuzzle}>New Puzzle</button>
        <span style={{ marginLeft: "auto" }}>Error: {s.error.toFixed(1)} | Missing: {s.missing}/{target.length}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {KINDS.map((k, i) => (
          <button key={i} onClick={() => setSelected(i)} style={{ background: selected === i ? "#345" : "#223", borderLeft: `4px solid ${k.color}` }}>
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
              onClick={(e) => clickCell(x, y, e)}
              style={{ cursor: "pointer" }}
            />
          )),
        )}
        {placed.map((o, i) => (
          <g key={i} pointerEvents="none">
            <circle cx={o.x * 50 + 25} cy={o.y * 50 + 25} r={16} fill={KINDS[o.kind].color} />
            <text x={o.x * 50 + 25} y={o.y * 50 + 30} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000">
              {KINDS[o.kind].name}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>X = pan, Y = louder→quieter · Shift-click = preview</div>
      {history.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          <div style={{ opacity: 0.7 }}>Recent puzzles:</div>
          {history.map((h, i) => (
            <div key={i} style={{ opacity: 0.85 }}>
              #{i + 1} · seed {h.seed} · error {h.error} · missing {h.missing}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
