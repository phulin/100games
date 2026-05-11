import { useEffect, useMemo, useRef, useState } from "react";

// Game 62 - Crystal Growth
// Place seed cells, then pulse N/E/S/W to bias growth.
// Targets are procedurally generated (no hardcoded shapes) with 8-fold symmetry.

const GRID = 31;
const CENTER = 15;

type Dir = "N" | "E" | "S" | "W";
const DIRS: Record<Dir, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

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

function countFilled(g: boolean[][]) {
  let c = 0;
  for (const row of g) for (const v of row) if (v) c++;
  return c;
}

function makeTarget(seed: number, density: number): boolean[][] {
  const rand = mulberry32(seed);
  const t: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const seedCount = 3 + Math.floor(rand() * 4);
  const quadrant: [number, number][] = [];
  for (let i = 0; i < seedCount; i++) {
    const r = 1 + Math.floor(rand() * 8);
    const a = rand() * Math.PI * 0.5;
    quadrant.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]);
  }
  function set(x: number, y: number) {
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
    t[y][x] = true;
  }
  function mirrorSet(qx: number, qy: number) {
    set(CENTER + qx, CENTER + qy);
    set(CENTER - qx, CENTER + qy);
    set(CENTER + qx, CENTER - qy);
    set(CENTER - qx, CENTER - qy);
    set(CENTER + qy, CENTER + qx);
    set(CENTER - qy, CENTER + qx);
    set(CENTER + qy, CENTER - qx);
    set(CENTER - qy, CENTER - qx);
  }
  for (const [dx, dy] of quadrant) mirrorSet(dx, dy);
  const targetCount = Math.max(40, Math.min(400, Math.floor(GRID * GRID * density)));
  let count = countFilled(t);
  let attempts = 0;
  while (count < targetCount && attempts < 2000) {
    attempts++;
    const qx = Math.floor(rand() * (CENTER + 1));
    const qy = Math.floor(rand() * (CENTER + 1));
    let neighbors = 0;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = qx + dx;
      const ny = qy + dy;
      if (nx >= 0 && nx <= GRID - 1 && ny >= 0 && ny <= GRID - 1) {
        if (t[CENTER + ny]?.[CENTER + nx]) neighbors++;
      }
    }
    if (neighbors >= 1 && rand() < 0.6) {
      mirrorSet(qx, qy);
      count = countFilled(t);
    }
  }
  return t;
}

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

export default function Game062_CrystalGrowth() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [density, setDensity] = useState(0.16);
  const target = useMemo(() => makeTarget(seed, density), [seed, density]);
  const [phase, setPhase] = useState<"seed" | "grow">("seed");
  const [crystal, setCrystal] = useState<boolean[][]>(() =>
    Array.from({ length: GRID }, () => Array(GRID).fill(false))
  );
  const [bias, setBias] = useState<Dir | null>(null);
  const [pulses, setPulses] = useState(0);
  const [running, setRunning] = useState(false);
  const [stalled, setStalled] = useState(false);
  const tickRef = useRef(0);
  const stallCountRef = useRef(0);
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tickRef.current++;
      setCrystal((g) => {
        const next = grow(g, bias);
        const c = countFilled(next);
        if (c === lastCountRef.current) {
          stallCountRef.current++;
          if (stallCountRef.current > 5) {
            setRunning(false);
            setStalled(true);
          }
        } else {
          stallCountRef.current = 0;
          lastCountRef.current = c;
        }
        return next;
      });
      if (tickRef.current % 2 === 0) setBias(null);
    }, 350);
    return () => clearInterval(id);
  }, [running, bias]);

  function grow(g: boolean[][], b: Dir | null): boolean[][] {
    const next = g.map((row) => row.slice());
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (g[y][x]) continue;
        let n = 0;
        let biasNeighbor = false;
        for (const [dx, dy] of Object.values(DIRS)) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
          if (g[ny][nx]) n++;
        }
        if (b) {
          const [dx, dy] = DIRS[b];
          const ox = x - dx;
          const oy = y - dy;
          if (ox >= 0 && ox < GRID && oy >= 0 && oy < GRID && g[oy][ox]) biasNeighbor = true;
        }
        let p = 0;
        if (n >= 1) p = 0.04;
        if (n >= 2) p = 0.12;
        if (biasNeighbor) p += 0.35;
        if (b && n >= 1 && Math.random() < 0.08) p += 0.2;
        if (Math.random() < p) next[y][x] = true;
      }
    }
    return next;
  }

  function placeSeed(x: number, y: number) {
    if (phase !== "seed") return;
    blip(700 + x * 8, 0.06, "triangle", 0.05);
    setCrystal((g) => {
      const next = g.map((r) => r.slice());
      next[y][x] = !next[y][x];
      return next;
    });
  }

  function startGrowth() {
    setPhase("grow");
    setRunning(true);
    stallCountRef.current = 0;
    lastCountRef.current = countFilled(crystal);
    blip(440, 0.2, "sine", 0.07);
  }

  function pulse(d: Dir) {
    setBias(d);
    setPulses((p) => p + 1);
    const freqs: Record<Dir, number> = { N: 880, E: 660, S: 440, W: 550 };
    blip(freqs[d], 0.12, "sawtooth", 0.05);
  }

  function reset(newSeed?: number) {
    const ns = newSeed ?? Math.floor(Math.random() * 1e9);
    setSeed(ns);
    setCrystal(Array.from({ length: GRID }, () => Array(GRID).fill(false)));
    setPulses(0);
    setBias(null);
    setRunning(false);
    setPhase("seed");
    setStalled(false);
    tickRef.current = 0;
    stallCountRef.current = 0;
    lastCountRef.current = 0;
  }

  let match = 0;
  let over = 0;
  let targetTotal = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (target[y][x]) targetTotal++;
      if (target[y][x] && crystal[y][x]) match++;
      if (!target[y][x] && crystal[y][x]) over++;
    }
  }
  const baseScore = targetTotal === 0 ? 0 : Math.max(0, Math.round((match / targetTotal) * 100 - over * 1.2));
  const efficiency = Math.max(0, Math.round(baseScore - pulses * 1.5));

  const cell = 14;
  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Crystal Growth</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Phase 1: click cells to place seed(s). Phase 2: pulse N/E/S/W to bias growth. Match the procedural target with as few pulses as possible.
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            {phase === "seed" ? "Place your seed cells" : "Growing..."}
          </div>
          <svg
            width={GRID * cell}
            height={GRID * cell}
            style={{ background: "#0d1320", borderRadius: 6, cursor: phase === "seed" ? "crosshair" : "default" }}
            onClick={(e) => {
              if (phase !== "seed") return;
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
              const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
              if (x >= 0 && x < GRID && y >= 0 && y < GRID) placeSeed(x, y);
            }}
          >
            {crystal.map((row, y) =>
              row.map((v, x) => {
                const inTarget = target[y][x];
                const fill = v ? (inTarget ? "#7df1c5" : "#ff7d8f") : inTarget ? "#234" : "transparent";
                return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} fill={fill} />;
              })
            )}
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 50px)", gap: 4 }}>
            <div />
            <button onClick={() => pulse("N")} disabled={phase !== "grow"}>N</button>
            <div />
            <button onClick={() => pulse("W")} disabled={phase !== "grow"}>W</button>
            <div style={{ textAlign: "center", padding: 6 }}>.</div>
            <button onClick={() => pulse("E")} disabled={phase !== "grow"}>E</button>
            <div />
            <button onClick={() => pulse("S")} disabled={phase !== "grow"}>S</button>
            <div />
          </div>
          <div>Pulses: {pulses}</div>
          <div>Match: {targetTotal === 0 ? 0 : Math.round((match / targetTotal) * 100)}% (over {over})</div>
          <div>Score: {baseScore} (efficiency {efficiency})</div>
          <div>Bias: {bias ?? "-"}{stalled ? " stalled" : ""}</div>
          {phase === "seed" ? (
            <button onClick={startGrowth} disabled={countFilled(crystal) === 0}>Start growth</button>
          ) : (
            <button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</button>
          )}
          <button onClick={() => reset()}>New target</button>
          <button onClick={() => reset(seed)}>Retry same target</button>
          <div style={{ fontSize: 12, marginTop: 6 }}>Target density:</div>
          <input
            type="range"
            min={0.06}
            max={0.32}
            step={0.02}
            value={density}
            disabled={phase === "grow"}
            onChange={(e) => setDensity(parseFloat(e.target.value))}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>Seed: {seed}</div>
        </div>
      </div>
    </div>
  );
}
