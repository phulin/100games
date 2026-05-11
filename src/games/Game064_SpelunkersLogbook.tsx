import { useEffect, useMemo, useRef, useState } from "react";

// Game 64 - Spelunker's Logbook
// Top-down cave with small light cone. Move with arrows. Click to drop marks.
// Procedurally placed gems (torch fuel) and hazards (torch damage).
// Persisted best step count per seed.

const W = 50;
const H = 34;
const TILE = 18;
const RADIUS = 3;
const STARTING_TORCH = 220;
const GEM_BONUS = 70;

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

function genCave(seed: number) {
  const rand = mulberry32(seed);
  let map: number[][] = Array.from({ length: H }, () => Array(W).fill(0).map(() => (rand() < 0.45 ? 1 : 0)));
  for (let it = 0; it < 4; it++) {
    const next = map.map((r) => r.slice());
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map[y + dy][x + dx] === 1) n++;
        next[y][x] = n >= 5 ? 1 : 0;
      }
    map = next;
  }
  for (let x = 0; x < W; x++) { map[0][x] = 1; map[H - 1][x] = 1; }
  for (let y = 0; y < H; y++) { map[y][0] = 1; map[y][W - 1] = 1; }
  let start: [number, number] = [2, 2];
  for (let y = 1; y < H; y++) { let found = false; for (let x = 1; x < W; x++) if (map[y][x] === 0) { start = [x, y]; found = true; break; } if (found) break; }
  let exit: [number, number] = [W - 3, H - 3];
  for (let y = H - 2; y > 0; y--) { let found = false; for (let x = W - 2; x > 0; x--) if (map[y][x] === 0) { exit = [x, y]; found = true; break; } if (found) break; }
  let cx = start[0], cy = start[1];
  while (cx !== exit[0] || cy !== exit[1]) {
    map[cy][cx] = 0;
    if (cx < exit[0]) cx++;
    else if (cx > exit[0]) cx--;
    else if (cy < exit[1]) cy++;
    else cy--;
  }
  const opens: [number, number][] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (map[y][x] === 0) opens.push([x, y]);
  for (let i = opens.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [opens[i], opens[j]] = [opens[j], opens[i]];
  }
  const gems: { x: number; y: number }[] = [];
  const hazards: { x: number; y: number }[] = [];
  const taken = new Set<string>();
  taken.add(`${start[0]},${start[1]}`);
  taken.add(`${exit[0]},${exit[1]}`);
  const gemCount = 5 + Math.floor(rand() * 4);
  const hazardCount = 4 + Math.floor(rand() * 4);
  let idx = 0;
  while (gems.length < gemCount && idx < opens.length) {
    const [x, y] = opens[idx++];
    const k = `${x},${y}`;
    if (taken.has(k)) continue;
    if (Math.hypot(x - start[0], y - start[1]) < 4) continue;
    taken.add(k);
    gems.push({ x, y });
  }
  while (hazards.length < hazardCount && idx < opens.length) {
    const [x, y] = opens[idx++];
    const k = `${x},${y}`;
    if (taken.has(k)) continue;
    if (Math.hypot(x - start[0], y - start[1]) < 5) continue;
    taken.add(k);
    hazards.push({ x, y });
  }
  return { map, start, exit, gems, hazards };
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
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.05) {
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

const BEST_KEY = "game064-best";

function loadBest(): Record<number, number> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export default function Game064_SpelunkersLogbook() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const cave = useMemo(() => genCave(seed), [seed]);
  const { map, start, exit, gems: gemsInit, hazards } = cave;
  const [pos, setPos] = useState<[number, number]>(start);
  const [seen, setSeen] = useState<boolean[][]>(() => Array.from({ length: H }, () => Array(W).fill(false)));
  const [marks, setMarks] = useState<{ x: number; y: number; kind: "wall" | "danger" | "note" }[]>([]);
  const [markKind, setMarkKind] = useState<"wall" | "danger" | "note">("wall");
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [torch, setTorch] = useState(STARTING_TORCH);
  const [steps, setSteps] = useState(0);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [bests, setBests] = useState<Record<number, number>>(loadBest);
  const seedRef = useRef(seed);

  useEffect(() => {
    if (seedRef.current !== seed) {
      seedRef.current = seed;
      setPos(start);
      setSeen(Array.from({ length: H }, () => Array(W).fill(false)));
      setMarks([]);
      setCollected(new Set());
      setTorch(STARTING_TORCH);
      setSteps(0);
      setWon(false);
      setDead(false);
    }
  }, [seed, start]);

  useEffect(() => {
    const newSeen = Array.from({ length: H }, () => Array(W).fill(false));
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dy * dy > RADIUS * RADIUS) continue;
        const nx = pos[0] + dx;
        const ny = pos[1] + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) newSeen[ny][nx] = true;
      }
    }
    setSeen((prev) => prev.map((row, y) => row.map((v, x) => v || newSeen[y][x])));
    if (pos[0] === exit[0] && pos[1] === exit[1] && !won) {
      setWon(true);
      blip(660, 0.2, "sine", 0.07);
      setTimeout(() => blip(990, 0.2, "sine", 0.07), 140);
      const prevBest = bests[seed];
      if (prevBest == null || steps < prevBest) {
        const next = { ...bests, [seed]: steps };
        setBests(next);
        try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch {}
      }
    }
  }, [pos, exit, won, bests, seed, steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won || dead) return;
      let [x, y] = pos;
      if (e.key === "ArrowUp" || e.key === "w") y--;
      else if (e.key === "ArrowDown" || e.key === "s") y++;
      else if (e.key === "ArrowLeft" || e.key === "a") x--;
      else if (e.key === "ArrowRight" || e.key === "d") x++;
      else if (e.key === "m") { setShowMinimap((v) => !v); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      if (map[y][x] === 1) {
        blip(120, 0.05, "square", 0.03);
        return;
      }
      blip(280 + Math.random() * 40, 0.04, "triangle", 0.03);
      setPos([x, y]);
      setSteps((n) => n + 1);
      setTorch((t) => {
        const nt = t - 1;
        if (nt <= 0) {
          setDead(true);
          blip(80, 0.5, "sawtooth", 0.08);
          return 0;
        }
        return nt;
      });
      const key = `${x},${y}`;
      if (gemsInit.some((g) => g.x === x && g.y === y) && !collected.has(key)) {
        setCollected((c) => new Set(c).add(key));
        setTorch((t) => Math.min(STARTING_TORCH * 2, t + GEM_BONUS));
        blip(1100, 0.12, "triangle", 0.07);
        setTimeout(() => blip(1400, 0.1, "triangle", 0.06), 60);
      }
      if (hazards.some((h) => h.x === x && h.y === y)) {
        setTorch((t) => Math.max(0, t - 40));
        blip(180, 0.2, "sawtooth", 0.06);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos, map, won, dead, gemsInit, hazards, collected]);

  function onCellClick(x: number, y: number) {
    setMarks((m) => {
      const idx = m.findIndex((mk) => mk.x === x && mk.y === y);
      if (idx >= 0) return m.filter((_, i) => i !== idx);
      return [...m, { x, y, kind: markKind }];
    });
    blip(440, 0.04, "square", 0.03);
  }

  function newCave(s: number) {
    setSeed(s);
  }

  const best = bests[seed];
  const torchPct = torch / STARTING_TORCH;
  const torchColor = torchPct > 0.5 ? "#dccca0" : torchPct > 0.2 ? "#f0a040" : "#e85d5d";
  const lightRadius = torch < 30 ? RADIUS - 1 : RADIUS;

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 950, margin: "0 auto", outline: "none" }} tabIndex={0}>
      <h2 style={{ margin: "8px 0" }}>Spelunker's Logbook</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Arrows or WASD to move. Click tiles to drop marks. Find gems to extend torch; avoid hazards. Press M for minimap.
      </div>
      <div style={{ display: "flex", gap: 8, margin: "6px 0", alignItems: "center" }}>
        {(["wall", "danger", "note"] as const).map((k) => (
          <button key={k} onClick={() => setMarkKind(k)} style={{ background: markKind === k ? "#345" : "#223" }}>
            {k}
          </button>
        ))}
        <button onClick={() => setShowMinimap((v) => !v)} style={{ background: showMinimap ? "#345" : "#223" }}>minimap</button>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          Steps: {steps} {best != null ? `(best ${best})` : ""} - Gems: {collected.size}/{gemsInit.length}
        </span>
        <button onClick={() => newCave(seed + 1)}>New Cave</button>
        <button onClick={() => newCave(seed)}>Retry</button>
      </div>
      <div style={{ height: 8, background: "#1a1a22", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ width: `${Math.max(0, Math.min(100, (torch / STARTING_TORCH) * 100))}%`, height: "100%", background: torchColor, transition: "width 0.15s" }} />
      </div>
      <div style={{ position: "relative" }}>
        <svg width={W * TILE} height={H * TILE} style={{ background: "#070b13", borderRadius: 6, maxWidth: "100%" }}>
          {map.map((row, y) =>
            row.map((v, x) => {
              const dx = x - pos[0];
              const dy = y - pos[1];
              const lit = dx * dx + dy * dy <= lightRadius * lightRadius;
              const wasSeen = seen[y][x];
              let fill = "#070b13";
              if (lit) fill = v ? "#3a2a18" : "#dccca0";
              else if (wasSeen) fill = v ? "#1c1410" : "#3b3320";
              return <rect key={`${x}-${y}`} x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill={fill} onClick={() => onCellClick(x, y)} style={{ cursor: "crosshair" }} />;
            })
          )}
          {gemsInit.map((g, i) => {
            const dx = g.x - pos[0];
            const dy = g.y - pos[1];
            const lit = dx * dx + dy * dy <= lightRadius * lightRadius;
            const key = `${g.x},${g.y}`;
            if (!lit) return null;
            if (collected.has(key)) return null;
            return (
              <text key={`gem-${i}`} x={g.x * TILE + TILE / 2} y={g.y * TILE + TILE * 0.8} textAnchor="middle" fontSize={TILE - 4} fill="#7df1c5" pointerEvents="none">*</text>
            );
          })}
          {hazards.map((h, i) => {
            const dx = h.x - pos[0];
            const dy = h.y - pos[1];
            const lit = dx * dx + dy * dy <= lightRadius * lightRadius;
            if (!lit) return null;
            return (
              <text key={`hz-${i}`} x={h.x * TILE + TILE / 2} y={h.y * TILE + TILE * 0.8} textAnchor="middle" fontSize={TILE - 4} fill="#ff5b5b" pointerEvents="none">x</text>
            );
          })}
          {marks.map((m, i) => {
            const color = m.kind === "wall" ? "#ff5b5b" : m.kind === "danger" ? "#ffcc55" : "#7df1c5";
            return (
              <text key={i} x={m.x * TILE + TILE / 2} y={m.y * TILE + TILE * 0.75} textAnchor="middle" fontSize={TILE - 4} fill={color} pointerEvents="none">
                {m.kind === "wall" ? "#" : m.kind === "danger" ? "!" : "."}
              </text>
            );
          })}
          <text x={exit[0] * TILE + TILE / 2} y={exit[1] * TILE + TILE * 0.8} textAnchor="middle" fontSize={TILE - 2} fill={pos[0] === exit[0] && pos[1] === exit[1] ? "#fff" : "transparent"} pointerEvents="none">
            X
          </text>
          <circle cx={pos[0] * TILE + TILE / 2} cy={pos[1] * TILE + TILE / 2} r={TILE / 2.5} fill="#5b8def" />
        </svg>
        {showMinimap && (
          <div style={{ position: "absolute", top: 6, right: 6, background: "#0d1320cc", padding: 4, borderRadius: 4 }}>
            <svg width={W * 3} height={H * 3}>
              {seen.map((row, y) =>
                row.map((v, x) => {
                  if (!v) return null;
                  const isWall = map[y][x] === 1;
                  return <rect key={`${x}-${y}`} x={x * 3} y={y * 3} width={3} height={3} fill={isWall ? "#5a3a20" : "#dccca0"} />;
                })
              )}
              <rect x={pos[0] * 3 - 1} y={pos[1] * 3 - 1} width={5} height={5} fill="#5b8def" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 13 }}>
        Marks: {marks.length} | Pos: {pos[0]},{pos[1]} | Torch: {torch} {won && "- ESCAPED!"} {dead && "- TORCH OUT"}
      </div>
    </div>
  );
}
