import { useEffect, useRef, useState } from "react";

// Game 62 - Crystal Growth
// Drop a seed. Click directional buttons to pulse growth in that direction.
// Pulses bias growth but also induce side-growth. Target: match a shape.

const GRID = 31;
const CENTER = 15;

type Dir = "N" | "E" | "S" | "W";
const DIRS: Record<Dir, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

function makeTarget(shape: "diamond" | "cross" | "L"): boolean[][] {
  const t: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  if (shape === "diamond") {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (Math.abs(x - CENTER) + Math.abs(y - CENTER) <= 7) t[y][x] = true;
  } else if (shape === "cross") {
    for (let i = -6; i <= 6; i++) {
      t[CENTER + i][CENTER] = true;
      t[CENTER][CENTER + i] = true;
      if (i !== 0) {
        t[CENTER + i][CENTER + (i > 0 ? 1 : -1)] = Math.abs(i) > 2 ? false : true;
        t[CENTER + (i > 0 ? 1 : -1)][CENTER + i] = Math.abs(i) > 2 ? false : true;
      }
    }
  } else {
    for (let i = 0; i < 8; i++) {
      t[CENTER + i][CENTER] = true;
      t[CENTER + 7][CENTER + i] = true;
    }
  }
  return t;
}

export default function Game062_CrystalGrowth() {
  const [shapes] = useState<("diamond" | "cross" | "L")[]>(["diamond", "cross", "L"]);
  const [shapeIdx, setShapeIdx] = useState(0);
  const [target, setTarget] = useState(() => makeTarget("diamond"));
  const [crystal, setCrystal] = useState<boolean[][]>(() => {
    const g = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    g[CENTER][CENTER] = true;
    return g;
  });
  const [bias, setBias] = useState<Dir | null>(null);
  const [pulses, setPulses] = useState(0);
  const [running, setRunning] = useState(true);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tickRef.current++;
      setCrystal((g) => grow(g, bias));
      // bias fades after a couple ticks
      if (tickRef.current % 2 === 0) setBias(null);
    }, 400);
    return () => clearInterval(id);
  }, [running, bias]);

  function grow(g: boolean[][], b: Dir | null): boolean[][] {
    const next = g.map((row) => row.slice());
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (g[y][x]) continue;
        // count neighbors
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
          // a cell is more likely to grow if its 'opposite' is filled and bias points toward it
          const ox = x - dx;
          const oy = y - dy;
          if (ox >= 0 && ox < GRID && oy >= 0 && oy < GRID && g[oy][ox]) biasNeighbor = true;
        }
        let p = 0;
        if (n >= 1) p = 0.04;
        if (n >= 2) p = 0.12;
        if (biasNeighbor) p += 0.35;
        // side-growth: random noise spurts
        if (b && n >= 1 && Math.random() < 0.08) p += 0.2;
        if (Math.random() < p) next[y][x] = true;
      }
    }
    return next;
  }

  function pulse(d: Dir) {
    setBias(d);
    setPulses((p) => p + 1);
  }

  function reset(idx = shapeIdx) {
    const g = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    g[CENTER][CENTER] = true;
    setCrystal(g);
    setPulses(0);
    setBias(null);
    setRunning(true);
    setShapeIdx(idx);
    setTarget(makeTarget(shapes[idx]));
    tickRef.current = 0;
  }

  // Score: cells that match target / total target cells - over-growth penalty
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
  const score = Math.max(0, Math.round((match / targetTotal) * 100 - over * 1.2));

  const cell = 14;
  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Crystal Growth</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Pulse N/E/S/W to bias growth. Pulses also stir side-growth. Match the target shape with as few pulses as possible. Pause to compare.
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Crystal</div>
          <svg width={GRID * cell} height={GRID * cell} style={{ background: "#0d1320", borderRadius: 6 }}>
            {crystal.map((row, y) =>
              row.map((v, x) => {
                const inTarget = target[y][x];
                const fill = v ? (inTarget ? "#7df1c5" : "#ff7d8f") : inTarget ? "#234" : "transparent";
                return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} fill={fill} />;
              })
            )}
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 50px)", gap: 4 }}>
            <div />
            <button onClick={() => pulse("N")}>N</button>
            <div />
            <button onClick={() => pulse("W")}>W</button>
            <div style={{ textAlign: "center", padding: 6 }}>•</div>
            <button onClick={() => pulse("E")}>E</button>
            <div />
            <button onClick={() => pulse("S")}>S</button>
            <div />
          </div>
          <div>Pulses: {pulses}</div>
          <div>Score: {score}</div>
          <div>Bias: {bias ?? "—"}</div>
          <button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</button>
          <button onClick={() => reset()}>Reset</button>
          <div style={{ fontSize: 12, marginTop: 6 }}>Target shape:</div>
          {shapes.map((s, i) => (
            <button key={s} onClick={() => reset(i)} style={{ background: i === shapeIdx ? "#345" : "" }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
