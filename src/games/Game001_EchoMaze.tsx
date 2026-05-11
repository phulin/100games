import { useEffect, useMemo, useRef, useState } from "react";

// Echo Maze: navigate a dark maze, ping to reveal walls (enemies hear pings).

const W = 21;
const H = 15;
const CELL = 36;

type Cell = { wall: boolean };

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

function genMaze(seed: number): Cell[][] {
  const rnd = mulberry32(seed);
  const grid: Cell[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ wall: true })),
  );
  const stack: [number, number][] = [[1, 1]];
  grid[1][1].wall = false;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ].sort(() => rnd() - 0.5);
    let carved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && grid[ny][nx].wall) {
        grid[ny][nx].wall = false;
        grid[y + dy / 2][x + dx / 2].wall = false;
        stack.push([nx, ny]);
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }
  return grid;
}

function dailySeed() {
  const d = new Date();
  return (
    d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  );
}

let _audioCtx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!_audioCtx) {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}
function beep(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.08) {
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export default function Game001_EchoMaze() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [daily, setDaily] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const maze = useMemo(() => genMaze(seed), [seed]);
  const [player, setPlayer] = useState({ x: 1, y: 1 });
  const [pings, setPings] = useState(0);
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [caught, setCaught] = useState(false);
  const startedRef = useRef<number>(performance.now());
  const pingRingsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const enemyCount = difficulty === "easy" ? 1 : difficulty === "hard" ? 3 : 2;
  const makeEnemies = () => {
    const list: { x: number; y: number; tx: number; ty: number; cooldown: number }[] = [];
    // BUG FIX: original spawned enemy on exit cell. Use non-exit spawn points.
    const spots: [number, number][] = [
      [W - 2, 1],
      [1, H - 2],
      [Math.floor(W / 2), Math.floor(H / 2)],
    ];
    for (let i = 0; i < enemyCount; i++) {
      const [x, y] = spots[i];
      list.push({ x, y, tx: x, ty: y, cooldown: 0 });
    }
    return list;
  };
  const enemiesRef = useRef(makeEnemies());
  const playerRef = useRef(player);
  playerRef.current = player;

  const exit = { x: W - 2, y: H - 2 };

  useEffect(() => {
    if (won || caught) return;
    const id = setInterval(() => {
      setElapsed((performance.now() - startedRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [won, caught]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        reset();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        ping();
        return;
      }
      if (won || caught) return;
      let dx = 0,
        dy = 0;
      if (e.key === "ArrowUp" || e.key === "w") dy = -1;
      else if (e.key === "ArrowDown" || e.key === "s") dy = 1;
      else if (e.key === "ArrowLeft" || e.key === "a") dx = -1;
      else if (e.key === "ArrowRight" || e.key === "d") dx = 1;
      else return;
      e.preventDefault();
      setPlayer((p) => {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return p;
        if (maze[ny][nx].wall) return p;
        beep(220 + Math.random() * 30, 0.04, "square", 0.03);
        setSteps((s) => s + 1);
        if (nx === exit.x && ny === exit.y) {
          setWon(true);
          beep(660, 0.18, "triangle", 0.12);
          setTimeout(() => beep(990, 0.22, "triangle", 0.12), 100);
        }
        return { x: nx, y: ny };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maze, won, caught]);

  const ping = () => {
    if (won || caught) return;
    pingRingsRef.current.push({ x: playerRef.current.x, y: playerRef.current.y, t: 0 });
    setPings((p) => p + 1);
    beep(880, 0.4, "sine", 0.1);
    setTimeout(() => beep(1320, 0.3, "sine", 0.05), 80);
    for (const en of enemiesRef.current) {
      en.tx = playerRef.current.x;
      en.ty = playerRef.current.y;
    }
  };

  const wonRef = useRef(won);
  wonRef.current = won;
  const caughtRef = useRef(caught);
  caughtRef.current = caught;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let enemyTick = 0;
    const enemyDelay = difficulty === "easy" ? 0.6 : difficulty === "hard" ? 0.32 : 0.45;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      enemyTick += dt;
      pingRingsRef.current = pingRingsRef.current
        .map((r) => ({ ...r, t: r.t + dt }))
        .filter((r) => r.t < 2);
      // BUG FIX: don't continue moving enemies (or trigger catches) after the
      // game ends — original loop kept running forever.
      if (enemyTick > enemyDelay && !wonRef.current && !caughtRef.current) {
        enemyTick = 0;
        for (const en of enemiesRef.current) {
          if (en.cooldown > 0) {
            en.cooldown--;
            continue;
          }
          const dx = Math.sign(en.tx - en.x);
          const dy = Math.sign(en.ty - en.y);
          const tries: [number, number][] = [];
          if (Math.abs(en.tx - en.x) > Math.abs(en.ty - en.y)) {
            tries.push([dx, 0], [0, dy], [0, -dy], [-dx, 0]);
          } else {
            tries.push([0, dy], [dx, 0], [-dx, 0], [0, -dy]);
          }
          for (const [mx, my] of tries) {
            if (mx === 0 && my === 0) continue;
            const nx = en.x + mx;
            const ny = en.y + my;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && !maze[ny][nx].wall) {
              en.x = nx;
              en.y = ny;
              break;
            }
          }
          if (
            !wonRef.current &&
            !caughtRef.current &&
            en.x === playerRef.current.x &&
            en.y === playerRef.current.y
          ) {
            setCaught(true);
            beep(120, 0.4, "sawtooth", 0.18);
            setTimeout(() => beep(70, 0.5, "sawtooth", 0.18), 120);
          }
        }
      }
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#05060a";
        ctx.fillRect(0, 0, c.width, c.height);
        const p = playerRef.current;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const cell = maze[y][x];
            let vis = 0;
            const dx = x - p.x;
            const dy = y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 2.5) vis = Math.max(vis, 1 - dist / 2.5);
            for (const r of pingRingsRef.current) {
              const rd = r.t * 8;
              const cd = Math.sqrt((x - r.x) ** 2 + (y - r.y) ** 2);
              if (Math.abs(cd - rd) < 0.8) {
                vis = Math.max(vis, (1 - r.t / 2) * 0.9);
              }
            }
            if (vis > 0.01) {
              if (cell.wall) {
                ctx.fillStyle = `rgba(80,140,220,${vis})`;
              } else {
                ctx.fillStyle = `rgba(20,30,50,${vis * 0.7})`;
              }
              ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
            }
          }
        }
        const exDist = Math.sqrt((exit.x - p.x) ** 2 + (exit.y - p.y) ** 2);
        if (exDist < 3) {
          const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
          ctx.fillStyle = `rgba(100,255,150,${(1 - exDist / 3) * pulse})`;
          ctx.fillRect(exit.x * CELL + 6, exit.y * CELL + 6, CELL - 12, CELL - 12);
        }
        for (const en of enemiesRef.current) {
          let vis = 0;
          const dd = Math.sqrt((en.x - p.x) ** 2 + (en.y - p.y) ** 2);
          if (dd < 3) vis = 1;
          for (const r of pingRingsRef.current) {
            const rd = r.t * 8;
            const cd = Math.sqrt((en.x - r.x) ** 2 + (en.y - r.y) ** 2);
            if (Math.abs(cd - rd) < 1) vis = Math.max(vis, 1 - r.t / 2);
          }
          if (vis > 0) {
            ctx.fillStyle = `rgba(255,80,80,${vis})`;
            ctx.beginPath();
            ctx.arc(en.x * CELL + CELL / 2, en.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = "#ffeb88";
        ctx.beginPath();
        ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [maze, difficulty]);

  const reset = (useDaily = daily) => {
    const ns = useDaily ? dailySeed() : Math.floor(Math.random() * 1e9);
    setSeed(ns);
    setPlayer({ x: 1, y: 1 });
    setPings(0);
    setSteps(0);
    setElapsed(0);
    setWon(false);
    setCaught(false);
    startedRef.current = performance.now();
    enemiesRef.current = makeEnemies();
    pingRingsRef.current = [];
  };

  const score = won ? Math.max(0, 5000 - pings * 80 - steps * 5 - Math.floor(elapsed * 10)) : 0;

  return (
    <div style={{ color: "#cde", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0" }}>Echo Maze</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Arrows/WASD to move. Click canvas or press <b>Space</b> to ping. Press <b>R</b> to restart. Reach the green exit; pings alert enemies.
      </div>
      <div style={{ margin: "6px 0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={daily}
            onChange={(e) => {
              setDaily(e.target.checked);
              const ns = e.target.checked ? dailySeed() : Math.floor(Math.random() * 1e9);
              setSeed(ns);
              setPlayer({ x: 1, y: 1 });
              setPings(0);
              setSteps(0);
              setElapsed(0);
              setWon(false);
              setCaught(false);
              startedRef.current = performance.now();
              enemiesRef.current = makeEnemies();
              pingRingsRef.current = [];
            }}
          />{" "}
          Daily seed
        </label>
        <label style={{ fontSize: 13 }}>
          Difficulty:{" "}
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as typeof difficulty);
              setTimeout(() => reset(daily), 0);
            }}
          >
            <option value="easy">easy (1 enemy)</option>
            <option value="normal">normal (2 enemies)</option>
            <option value="hard">hard (3 enemies)</option>
          </select>
        </label>
        <span style={{ fontSize: 13 }}>
          Pings: {pings} | Steps: {steps} | Time: {elapsed.toFixed(1)}s
        </span>
        {won && <span style={{ color: "#9f9" }}>— escaped! score {score}</span>}
        {caught && <span style={{ color: "#f99" }}>— caught!</span>}
        {(won || caught) && (
          <button type="button" onClick={() => reset()} style={{ marginLeft: 8 }}>
            new maze
          </button>
        )}
      </div>
      <canvas
        key={seed}
        ref={canvasRef}
        width={W * CELL}
        height={H * CELL}
        onClick={ping}
        tabIndex={0}
        aria-label="Echo Maze playfield"
        style={{
          background: "#000",
          cursor: "crosshair",
          display: "block",
          outline: "2px solid transparent",
        }}
        onFocus={(e) => (e.currentTarget.style.outline = "2px solid #5af")}
        onBlur={(e) => (e.currentTarget.style.outline = "2px solid transparent")}
      />
    </div>
  );
}
