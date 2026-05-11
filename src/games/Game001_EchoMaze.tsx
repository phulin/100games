import { useEffect, useRef, useState } from "react";

// Echo Maze: navigate a dark maze, ping to reveal walls (enemies hear pings).

const W = 21;
const H = 15;
const CELL = 36;

type Cell = { wall: boolean };

function genMaze(seed: number): Cell[][] {
  // simple randomized DFS
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
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

export default function Game001_EchoMaze() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [maze] = useState(() => genMaze(seed));
  const [player, setPlayer] = useState({ x: 1, y: 1 });
  const [pings, setPings] = useState(0);
  const [won, setWon] = useState(false);
  const [caught, setCaught] = useState(false);
  const pingRingsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const enemiesRef = useRef<{ x: number; y: number; tx: number; ty: number; cooldown: number }[]>(
    [
      { x: W - 2, y: H - 2, tx: W - 2, ty: H - 2, cooldown: 0 },
      { x: W - 2, y: 1, tx: W - 2, ty: 1, cooldown: 0 },
    ],
  );
  const playerRef = useRef(player);
  playerRef.current = player;
  const wonRef = useRef(won);
  wonRef.current = won;

  const exit = { x: W - 2, y: H - 2 };

  // movement
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        if (nx === exit.x && ny === exit.y) setWon(true);
        return { x: nx, y: ny };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maze, won, caught]);

  const ping = () => {
    if (won || caught) return;
    pingRingsRef.current.push({ x: player.x, y: player.y, t: 0 });
    setPings((p) => p + 1);
    // alert enemies
    for (const en of enemiesRef.current) {
      en.tx = player.x;
      en.ty = player.y;
    }
  };

  // game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let enemyTick = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      enemyTick += dt;
      // update rings
      pingRingsRef.current = pingRingsRef.current
        .map((r) => ({ ...r, t: r.t + dt }))
        .filter((r) => r.t < 2);
      // move enemies on ticks
      if (enemyTick > 0.45) {
        enemyTick = 0;
        for (const en of enemiesRef.current) {
          if (en.cooldown > 0) {
            en.cooldown--;
            continue;
          }
          // bfs one step toward target
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
          if (en.x === playerRef.current.x && en.y === playerRef.current.y) {
            setCaught(true);
          }
        }
      }
      // render
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#05060a";
        ctx.fillRect(0, 0, c.width, c.height);
        const p = playerRef.current;
        // walls visible: within radius of player, or within active rings
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
        // exit
        const exDist = Math.sqrt((exit.x - p.x) ** 2 + (exit.y - p.y) ** 2);
        if (exDist < 3) {
          ctx.fillStyle = `rgba(100,255,150,${1 - exDist / 3})`;
          ctx.fillRect(exit.x * CELL + 6, exit.y * CELL + 6, CELL - 12, CELL - 12);
        }
        // enemies - only visible if within range or in active ring
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
        // player
        ctx.fillStyle = "#ffeb88";
        ctx.beginPath();
        ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [maze]);

  const reset = () => {
    const ns = Math.floor(Math.random() * 1e9);
    setSeed(ns);
    setPlayer({ x: 1, y: 1 });
    setPings(0);
    setWon(false);
    setCaught(false);
    enemiesRef.current = [
      { x: W - 2, y: H - 2, tx: W - 2, ty: H - 2, cooldown: 0 },
      { x: W - 2, y: 1, tx: W - 2, ty: 1, cooldown: 0 },
    ];
    pingRingsRef.current = [];
    // re-mount maze by reload: easiest is full page; but we just leave maze constant.
  };

  return (
    <div style={{ color: "#cde", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0" }}>Echo Maze</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Arrows/WASD to move. Click canvas to ping (enemies hear it). Reach the green exit.
      </div>
      <div style={{ margin: "6px 0" }}>
        Pings: {pings} {won && "— escaped!"} {caught && "— caught!"}{" "}
        {(won || caught) && (
          <button type="button" onClick={reset} style={{ marginLeft: 8 }}>
            new maze (reload)
          </button>
        )}
      </div>
      <canvas
        key={seed}
        ref={canvasRef}
        width={W * CELL}
        height={H * CELL}
        onClick={ping}
        style={{ background: "#000", cursor: "crosshair", display: "block" }}
      />
    </div>
  );
}
