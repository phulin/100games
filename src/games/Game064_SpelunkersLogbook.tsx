import { useEffect, useRef, useState } from "react";

// Game 64 - Spelunker's Logbook
// Top-down cave. You see a small light cone. Move with arrows.
// Click to drop a mark on the map (your own notes). Find the exit.

const W = 50;
const H = 34;
const TILE = 18;
const RADIUS = 3;

function genCave(seed: number) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  // start with noise
  let map: number[][] = Array.from({ length: H }, () => Array(W).fill(0).map(() => (rand() < 0.45 ? 1 : 0)));
  // smooth
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
  // borders
  for (let x = 0; x < W; x++) {
    map[0][x] = 1;
    map[H - 1][x] = 1;
  }
  for (let y = 0; y < H; y++) {
    map[y][0] = 1;
    map[y][W - 1] = 1;
  }
  // place start and exit far apart in open space
  let start: [number, number] = [2, 2];
  for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) if (map[y][x] === 0) { start = [x, y]; y = H; break; }
  let exit: [number, number] = [W - 3, H - 3];
  for (let y = H - 2; y > 0; y--) for (let x = W - 2; x > 0; x--) if (map[y][x] === 0) { exit = [x, y]; y = 0; break; }
  // carve a path between to guarantee reachability
  let cx = start[0], cy = start[1];
  while (cx !== exit[0] || cy !== exit[1]) {
    map[cy][cx] = 0;
    if (cx < exit[0]) cx++;
    else if (cx > exit[0]) cx--;
    else if (cy < exit[1]) cy++;
    else cy--;
  }
  return { map, start, exit };
}

export default function Game064_SpelunkersLogbook() {
  const [seed, setSeed] = useState(42);
  const [{ map, start, exit }, setCave] = useState(() => genCave(42));
  const [pos, setPos] = useState<[number, number]>(start);
  const [seen, setSeen] = useState<boolean[][]>(() => Array.from({ length: H }, () => Array(W).fill(false)));
  const [marks, setMarks] = useState<{ x: number; y: number; kind: "wall" | "danger" | "note" }[]>([]);
  const [markKind, setMarkKind] = useState<"wall" | "danger" | "note">("wall");
  const [won, setWon] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (pos[0] === exit[0] && pos[1] === exit[1]) setWon(true);
  }, [pos, exit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      let [x, y] = pos;
      if (e.key === "ArrowUp" || e.key === "w") y--;
      else if (e.key === "ArrowDown" || e.key === "s") y++;
      else if (e.key === "ArrowLeft" || e.key === "a") x--;
      else if (e.key === "ArrowRight" || e.key === "d") x++;
      else return;
      e.preventDefault();
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      if (map[y][x] === 1) return;
      setPos([x, y]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos, map, won]);

  function onCellClick(x: number, y: number) {
    setMarks((m) => {
      const idx = m.findIndex((mk) => mk.x === x && mk.y === y);
      if (idx >= 0) return m.filter((_, i) => i !== idx);
      return [...m, { x, y, kind: markKind }];
    });
  }

  function reset(s = seed) {
    setSeed(s);
    const c = genCave(s);
    setCave(c);
    setPos(c.start);
    setSeen(Array.from({ length: H }, () => Array(W).fill(false)));
    setMarks([]);
    setWon(false);
  }

  return (
    <div ref={containerRef} style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 950, margin: "0 auto", outline: "none" }} tabIndex={0}>
      <h2 style={{ margin: "8px 0" }}>Spelunker's Logbook</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Arrow keys to move. You only see a small light. Click any tile to drop a mark — they persist even in darkness. Find the exit (X).
      </div>
      <div style={{ display: "flex", gap: 8, margin: "6px 0" }}>
        {(["wall", "danger", "note"] as const).map((k) => (
          <button key={k} onClick={() => setMarkKind(k)} style={{ background: markKind === k ? "#345" : "#223" }}>
            {k}
          </button>
        ))}
        <button onClick={() => reset(seed + 1)} style={{ marginLeft: "auto" }}>New Cave</button>
      </div>
      <svg width={W * TILE} height={H * TILE} style={{ background: "#070b13", borderRadius: 6, maxWidth: "100%" }}>
        {map.map((row, y) =>
          row.map((v, x) => {
            const dx = x - pos[0];
            const dy = y - pos[1];
            const lit = dx * dx + dy * dy <= RADIUS * RADIUS;
            const wasSeen = seen[y][x];
            let fill = "#070b13";
            if (lit) fill = v ? "#3a2a18" : "#dccca0";
            else if (wasSeen) fill = v ? "#1c1410" : "#3b3320";
            return <rect key={`${x}-${y}`} x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill={fill} onClick={() => onCellClick(x, y)} style={{ cursor: "crosshair" }} />;
          })
        )}
        {marks.map((m, i) => {
          const color = m.kind === "wall" ? "#ff5b5b" : m.kind === "danger" ? "#ffcc55" : "#7df1c5";
          return (
            <text key={i} x={m.x * TILE + TILE / 2} y={m.y * TILE + TILE * 0.75} textAnchor="middle" fontSize={TILE - 4} fill={color} pointerEvents="none">
              {m.kind === "wall" ? "▮" : m.kind === "danger" ? "!" : "•"}
            </text>
          );
        })}
        <text x={exit[0] * TILE + TILE / 2} y={exit[1] * TILE + TILE * 0.8} textAnchor="middle" fontSize={TILE - 2} fill={pos[0] === exit[0] && pos[1] === exit[1] ? "#fff" : "transparent"} pointerEvents="none">
          X
        </text>
        <circle cx={pos[0] * TILE + TILE / 2} cy={pos[1] * TILE + TILE / 2} r={TILE / 2.5} fill="#5b8def" />
      </svg>
      <div>Marks: {marks.length} | Pos: {pos[0]},{pos[1]} {won && "— ESCAPED!"}</div>
    </div>
  );
}
